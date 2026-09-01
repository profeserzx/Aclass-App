"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentClaims, fees, students, payments } from "@/db/schema";
import { getSession } from "@/lib/session";
import { recomputeFeeStatus } from "@/app/actions/payments";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

function revalidateClaimViews() {
  revalidatePath("/parent");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
}

export async function submitPaymentClaimAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") redirect("/dashboard");

  const feeId = String(formData.get("feeId") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const methodRaw = String(formData.get("method") || "").trim();
  const transactionRef = String(formData.get("transactionRef") || "").trim();
  const amount = Number(amountRaw);

  if (!feeId || !amountRaw || Number.isNaN(amount) || amount <= 0 || !transactionRef) {
    redirect(
      `/parent?error=${encodeURIComponent(
        "Choose a fee, enter a valid amount, and include the M-Pesa code or bank reference."
      )}`
    );
  }
  const method = (PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof PAYMENT_METHODS)[number])
    : "mpesa";

  // Verify this fee actually belongs to THIS parent's own child — a parent
  // must never be able to submit a claim against another family's fee.
  const [fee] = await db
    .select({ id: fees.id, schoolId: fees.schoolId })
    .from(fees)
    .innerJoin(students, eq(fees.studentId, students.id))
    .where(and(eq(fees.id, feeId), eq(students.userId, session.userId)))
    .limit(1);
  if (!fee) {
    redirect(`/parent?error=${encodeURIComponent("That fee record wasn't found.")}`);
  }

  await db.insert(paymentClaims).values({
    schoolId: fee.schoolId,
    feeId,
    submittedBy: session.userId,
    amount: amount.toFixed(2),
    method,
    transactionRef,
  });

  // No redirect: called from /parent itself.
  revalidateClaimViews();
}

export async function cancelPaymentClaimAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") return;

  const claimId = String(formData.get("claimId") || "");
  if (!claimId) return;

  // Only the parent's own still-pending claim can be withdrawn.
  await db
    .delete(paymentClaims)
    .where(
      and(
        eq(paymentClaims.id, claimId),
        eq(paymentClaims.submittedBy, session.userId),
        eq(paymentClaims.status, "pending")
      )
    );
  revalidateClaimViews();
}

export async function reviewPaymentClaimAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/payments?error=${encodeURIComponent("Only an admin can review payment claims.")}`);
  }

  const claimId = String(formData.get("claimId") || "");
  const decisionRaw = String(formData.get("decision") || "");
  const reviewNote = String(formData.get("reviewNote") || "").trim() || null;
  if (!claimId || (decisionRaw !== "approved" && decisionRaw !== "rejected")) return;
  const decision = decisionRaw as "approved" | "rejected";

  // Scoped to this school and must still be pending — prevents double-approving
  // (which would double-count the payment) or acting on another school's claim.
  const [claim] = await db
    .select()
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.id, claimId),
        eq(paymentClaims.schoolId, session.schoolId),
        eq(paymentClaims.status, "pending")
      )
    )
    .limit(1);
  if (!claim) return;

  if (decision === "approved") {
    // This is the one place a parent-initiated action produces a real,
    // fee-affecting payment row — only after an admin has verified it.
    await db.insert(payments).values({
      feeId: claim.feeId,
      amount: claim.amount,
      method: claim.method,
      transactionRef: claim.transactionRef,
    });
    await recomputeFeeStatus(claim.feeId);
  }

  await db
    .update(paymentClaims)
    .set({ status: decision, reviewNote, reviewedBy: session.userId, reviewedAt: new Date() })
    .where(eq(paymentClaims.id, claimId));

  revalidateClaimViews();
}
