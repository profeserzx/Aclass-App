"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fees, students } from "@/db/schema";
import { getSession } from "@/lib/session";

function revalidateFeeViews() {
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/payments");
  revalidatePath("/parent");
}

const FEE_STATUSES = ["pending", "partial", "paid", "overdue"] as const;

function readFeeFields(formData: FormData) {
  const studentId = String(formData.get("studentId") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const term = String(formData.get("term") || "").trim() || null;
  const amountRaw = String(formData.get("amount") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  const statusRaw = String(formData.get("status") || "pending").trim();
  const status = (FEE_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof FEE_STATUSES)[number])
    : "pending";
  return { studentId, description, term, amountRaw, dueDate, status };
}

export async function addFeeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/fees?error=${encodeURIComponent("Only an admin can add fee records.")}`);
  }

  const { studentId, description, term, amountRaw, dueDate, status } = readFeeFields(formData);
  const amount = Number(amountRaw);

  if (!studentId || !description || !dueDate || !amountRaw || Number.isNaN(amount) || amount <= 0) {
    redirect(`/dashboard/fees?error=${encodeURIComponent("Fill in student, description, amount, and due date.")}`);
  }

  // Confirm the student actually belongs to this admin's school before attaching a fee to them.
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) {
    redirect(`/dashboard/fees?error=${encodeURIComponent("That student wasn't found.")}`);
  }

  await db.insert(fees).values({
    schoolId: session.schoolId,
    studentId,
    description,
    term,
    amount: amount.toFixed(2),
    dueDate,
    status,
  });
  // No redirect: called from /dashboard/fees itself.
  revalidateFeeViews();
}

export async function updateFeeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/fees?error=${encodeURIComponent("Only an admin can edit fee records.")}`);
  }

  const feeId = String(formData.get("feeId") || "");
  if (!feeId) redirect("/dashboard/fees");

  const { description, term, amountRaw, dueDate, status } = readFeeFields(formData);
  const amount = Number(amountRaw);

  if (!description || !dueDate || !amountRaw || Number.isNaN(amount) || amount <= 0) {
    redirect(`/dashboard/fees/${feeId}/edit?error=${encodeURIComponent("Fill in description, amount, and due date.")}`);
  }

  await db
    .update(fees)
    .set({ description, term, amount: amount.toFixed(2), dueDate, status })
    .where(and(eq(fees.id, feeId), eq(fees.schoolId, session.schoolId)));

  revalidateFeeViews();
  // This one does need to redirect — it's called from the edit page, a
  // different route than the fees list we're sending the admin back to.
  redirect("/dashboard/fees");
}

export async function deleteFeeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const feeId = String(formData.get("feeId") || "");
  if (!feeId) return;

  // Cascades to any payments recorded against this fee (see schema's onDelete: "cascade").
  await db.delete(fees).where(and(eq(fees.id, feeId), eq(fees.schoolId, session.schoolId)));
  revalidateFeeViews();
}
