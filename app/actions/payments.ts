"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, payments } from "@/db/schema";
import { getSession } from "@/lib/session";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

function revalidatePaymentViews() {
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
  revalidatePath("/parent");
}

export async function recomputeFeeStatus(feeId: string) {
  const [fee] = await db.select().from(fees).where(eq(fees.id, feeId)).limit(1);
  if (!fee) return;

  const [{ value: totalPaid }] = await db
    .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
    .from(payments)
    .where(eq(payments.feeId, feeId));

  const amount = Number(fee.amount);
  const today = new Date().toISOString().slice(0, 10);

  let status: "pending" | "partial" | "paid" | "overdue";
  if (totalPaid >= amount) status = "paid";
  else if (totalPaid > 0) status = "partial";
  else status = fee.dueDate < today ? "overdue" : "pending";

  await db.update(fees).set({ status }).where(eq(fees.id, feeId));
}

/**
 * Records a payment. Not currently exposed on the admin dashboard (admin is
 * view-only for payments) — kept here for the parent-facing payment flow
 * we'll build later.
 */
export async function recordPaymentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const feeId = String(formData.get("feeId") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const methodRaw = String(formData.get("method") || "").trim();
  const transactionRef = String(formData.get("transactionRef") || "").trim() || null;
  const amount = Number(amountRaw);

  if (!feeId || !amountRaw || Number.isNaN(amount) || amount <= 0) {
    redirect(`/dashboard/payments?error=${encodeURIComponent("Choose a fee and enter a valid amount.")}`);
  }
  const method = (PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof PAYMENT_METHODS)[number])
    : "mpesa";

  // Confirm the fee actually belongs to this admin's school before recording anything against it.
  const [fee] = await db
    .select()
    .from(fees)
    .where(and(eq(fees.id, feeId), eq(fees.schoolId, session.schoolId)))
    .limit(1);
  if (!fee) {
    redirect(`/dashboard/payments?error=${encodeURIComponent("That fee record wasn't found.")}`);
  }

  await db.insert(payments).values({
    feeId,
    amount: amount.toFixed(2),
    method,
    transactionRef,
  });

  await recomputeFeeStatus(feeId);
  // No redirect: this is called from /dashboard/payments itself.
  revalidatePaymentViews();
}

export async function deletePaymentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const paymentId = String(formData.get("paymentId") || "");
  if (!paymentId) return;

  // Join through fees to make sure this payment belongs to the admin's school.
  const [row] = await db
    .select({ feeId: payments.feeId })
    .from(payments)
    .innerJoin(fees, eq(payments.feeId, fees.id))
    .where(and(eq(payments.id, paymentId), eq(fees.schoolId, session.schoolId)))
    .limit(1);

  if (row) {
    await db.delete(payments).where(eq(payments.id, paymentId));
    await recomputeFeeStatus(row.feeId);
    revalidatePaymentViews();
  }
}
