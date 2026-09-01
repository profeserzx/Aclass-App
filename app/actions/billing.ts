"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformStkPushRequests, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { initiateStkPush, normalizeKenyanPhone, type MpesaCredentials } from "@/lib/mpesa";
import { PLAN_PRICE_KES } from "@/lib/plans";

// Aclass's OWN Daraja app/Paybill, used to collect subscription payments FROM
// schools. Deliberately separate from getSchoolMpesaCredentials() in
// app/actions/mpesa.ts (that one is per-school, DB-stored, encrypted — this
// one is a single app-wide credential set read straight from env vars).
function getPlatformMpesaCredentials(): MpesaCredentials {
  const { PLATFORM_MPESA_ENV, PLATFORM_MPESA_SHORTCODE, PLATFORM_MPESA_CONSUMER_KEY, PLATFORM_MPESA_CONSUMER_SECRET, PLATFORM_MPESA_PASSKEY } =
    process.env;
  if (!PLATFORM_MPESA_SHORTCODE || !PLATFORM_MPESA_CONSUMER_KEY || !PLATFORM_MPESA_CONSUMER_SECRET || !PLATFORM_MPESA_PASSKEY) {
    throw new Error("Aclass's own M-Pesa credentials aren't configured (PLATFORM_MPESA_* in .env.local).");
  }
  return {
    env: PLATFORM_MPESA_ENV === "production" ? "production" : "sandbox",
    shortcode: PLATFORM_MPESA_SHORTCODE,
    consumerKey: PLATFORM_MPESA_CONSUMER_KEY,
    consumerSecret: PLATFORM_MPESA_CONSUMER_SECRET,
    passkey: PLATFORM_MPESA_PASSKEY,
  };
}

function requirePlatformCallbackUrl(): string {
  const value = process.env.PLATFORM_MPESA_CALLBACK_URL;
  if (!value) {
    throw new Error("PLATFORM_MPESA_CALLBACK_URL is not set in .env.local.");
  }
  return value;
}

function revalidateBillingViews() {
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  revalidatePath("/parent");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard/payments");
}

/**
 * Admin taps "Upgrade to Growth": push a PIN prompt to their own phone to pay
 * Aclass directly. Only kicks the request off — app/api/mpesa/platform-callback
 * is what actually upgrades the school's plan once Safaricom confirms payment.
 */
export async function initiatePlatformSubscriptionPaymentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const phoneRaw = String(formData.get("phoneNumber") || "").trim();
  const planRaw = String(formData.get("plan") || "growth").trim();

  if (planRaw !== "growth") {
    redirect(`/dashboard/billing?error=${encodeURIComponent("District plan is custom-priced — contact us directly to set it up.")}`);
  }

  const phoneNumber = normalizeKenyanPhone(phoneRaw);
  if (!phoneNumber) {
    redirect(`/dashboard/billing?error=${encodeURIComponent("Enter a valid Safaricom number, e.g. 0712345678.")}`);
  }

  const [school] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);
  if (!school) redirect("/dashboard");

  const amount = PLAN_PRICE_KES.growth;

  const [request] = await db
    .insert(platformStkPushRequests)
    .values({
      schoolId: session.schoolId,
      plan: "growth",
      initiatedBy: session.userId,
      phoneNumber: phoneNumber!,
      amount: amount.toFixed(2),
    })
    .returning();

  try {
    const credentials = getPlatformMpesaCredentials();
    const result = await initiateStkPush(credentials, {
      phoneNumber: phoneNumber!,
      amount,
      accountReference: (school?.name || "Aclass").slice(0, 12),
      transactionDesc: "Aclass Growth",
      callbackUrl: requirePlatformCallbackUrl(),
    });

    await db
      .update(platformStkPushRequests)
      .set({
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
      })
      .where(eq(platformStkPushRequests.id, request.id));
  } catch (err) {
    await db
      .update(platformStkPushRequests)
      .set({
        status: "failed",
        resultDesc: err instanceof Error ? err.message : "Failed to reach M-Pesa.",
        completedAt: new Date(),
      })
      .where(eq(platformStkPushRequests.id, request.id));
    revalidateBillingViews();
    redirect(
      `/dashboard/billing?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Could not start the M-Pesa payment. Try again."
      )}`
    );
  }

  revalidateBillingViews();
  redirect(`/dashboard/billing?platformStkPushId=${request.id}`);
}

/** Polled from the client while a platform subscription push is pending. */
export async function getPlatformStkStatusAction(requestId: string) {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select()
    .from(platformStkPushRequests)
    .where(eq(platformStkPushRequests.id, requestId))
    .limit(1);

  if (!row) return null;
  // Only someone in the same school (the one paying) can poll its status.
  if (row.schoolId !== session.schoolId) return null;

  return {
    status: row.status,
    resultDesc: row.resultDesc,
    mpesaReceiptNumber: row.mpesaReceiptNumber,
  };
}
