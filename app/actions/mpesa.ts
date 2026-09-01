"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stkPushRequests, fees, students, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { initiateStkPush, normalizeKenyanPhone, type MpesaCredentials } from "@/lib/mpesa";
import { decryptSecret } from "@/lib/crypto";

function revalidateMpesaViews() {
  revalidatePath("/parent");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
}

/** Loads and decrypts the given school's own Daraja credentials, if configured. */
async function getSchoolMpesaCredentials(schoolId: string): Promise<MpesaCredentials | null> {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (
    !school ||
    !school.mpesaShortcode ||
    !school.mpesaConsumerKey ||
    !school.mpesaConsumerSecret ||
    !school.mpesaPasskey
  ) {
    return null;
  }
  return {
    env: school.mpesaEnv === "production" ? "production" : "sandbox",
    shortcode: school.mpesaShortcode,
    consumerKey: school.mpesaConsumerKey,
    consumerSecret: decryptSecret(school.mpesaConsumerSecret),
    passkey: decryptSecret(school.mpesaPasskey),
  };
}

/**
 * Parent taps "Pay with M-Pesa": push a PIN prompt to their phone. This just
 * kicks the request off — the real pay/cancel result comes back later via
 * app/api/mpesa/callback, which is what actually marks the fee paid.
 */
export async function initiateMpesaPaymentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") redirect("/dashboard");

  const feeId = String(formData.get("feeId") || "").trim();
  const phoneRaw = String(formData.get("phoneNumber") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const amount = Number(amountRaw);

  if (!feeId || !phoneRaw || !amountRaw || Number.isNaN(amount) || amount <= 0) {
    redirect(
      `/parent?error=${encodeURIComponent("Choose a fee, enter a valid amount, and your M-Pesa phone number.")}`
    );
  }

  const phoneNumber = normalizeKenyanPhone(phoneRaw);
  if (!phoneNumber) {
    redirect(
      `/parent?error=${encodeURIComponent("Enter a valid Safaricom number, e.g. 0712345678.")}`
    );
  }

  // Verify this fee actually belongs to THIS parent's own child.
  const [fee] = await db
    .select({ id: fees.id, schoolId: fees.schoolId, description: fees.description })
    .from(fees)
    .innerJoin(students, eq(fees.studentId, students.id))
    .where(and(eq(fees.id, feeId), eq(students.userId, session.userId)))
    .limit(1);
  if (!fee) {
    redirect(`/parent?error=${encodeURIComponent("That fee record wasn't found.")}`);
  }

  const credentials = await getSchoolMpesaCredentials(fee.schoolId);
  if (!credentials) {
    redirect(
      `/parent?error=${encodeURIComponent(
        "Your school hasn't set up M-Pesa payments yet. Ask the school office, or use 'Report a payment' below instead."
      )}`
    );
  }

  const [request] = await db
    .insert(stkPushRequests)
    .values({
      schoolId: fee.schoolId,
      feeId,
      initiatedBy: session.userId,
      phoneNumber: phoneNumber!,
      amount: amount.toFixed(2),
    })
    .returning();

  try {
    const result = await initiateStkPush(credentials!, {
      phoneNumber: phoneNumber!,
      amount,
      accountReference: fee.description || "School fees",
      transactionDesc: "School fees",
    });

    await db
      .update(stkPushRequests)
      .set({
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
      })
      .where(eq(stkPushRequests.id, request.id));
  } catch (err) {
    await db
      .update(stkPushRequests)
      .set({
        status: "failed",
        resultDesc: err instanceof Error ? err.message : "Failed to reach M-Pesa.",
        completedAt: new Date(),
      })
      .where(eq(stkPushRequests.id, request.id));
    revalidateMpesaViews();
    redirect(
      `/parent?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Could not start the M-Pesa payment. Try again."
      )}`
    );
  }

  revalidateMpesaViews();
  redirect(`/parent?stkPushId=${request.id}`);
}

/** Polled from the client while a push is pending, to show live status. */
export async function getStkPushStatusAction(requestId: string) {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select()
    .from(stkPushRequests)
    .where(eq(stkPushRequests.id, requestId))
    .limit(1);

  if (!row) return null;
  // Only the parent who initiated it (or an admin) can poll its status.
  if (session.role === "parent" && row.initiatedBy !== session.userId) return null;

  return {
    status: row.status,
    resultDesc: row.resultDesc,
    mpesaReceiptNumber: row.mpesaReceiptNumber,
  };
}
