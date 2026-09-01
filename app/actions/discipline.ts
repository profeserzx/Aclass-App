"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { disciplineCases, students } from "@/db/schema";
import { getSession } from "@/lib/session";

function canManage(role: string): boolean {
  return role === "admin" || role === "dean";
}

function revalidateDisciplineViews() {
  revalidatePath("/dashboard/discipline");
  revalidatePath("/dashboard");
}

export async function createDisciplineCaseAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");
  if (!canManage(session.role)) {
    redirect(`/dashboard/discipline?error=${encodeURIComponent("Only an admin or the dean can log discipline cases.")}`);
  }

  const studentId = String(formData.get("studentId") || "").trim();
  const incidentDate = String(formData.get("incidentDate") || "").trim();
  const offense = String(formData.get("offense") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const actionTaken = String(formData.get("actionTaken") || "").trim() || null;

  if (!studentId || !incidentDate || !offense) {
    redirect(`/dashboard/discipline?error=${encodeURIComponent("Student, date, and offense are required.")}`);
  }

  // Verify the student actually belongs to this school before writing.
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) {
    redirect(`/dashboard/discipline?error=${encodeURIComponent("That student was not found.")}`);
  }

  await db.insert(disciplineCases).values({
    schoolId: session.schoolId,
    studentId,
    reportedBy: session.userId,
    incidentDate,
    offense,
    description,
    actionTaken,
  });

  // No redirect — called from /dashboard/discipline itself.
  revalidateDisciplineViews();
}

export async function setDisciplineCaseStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManage(session.role)) return;

  const caseId = String(formData.get("caseId") || "");
  const statusRaw = String(formData.get("status") || "");
  if (!caseId || (statusRaw !== "open" && statusRaw !== "closed")) return;
  const status = statusRaw as "open" | "closed";

  await db
    .update(disciplineCases)
    .set({ status, closedAt: status === "closed" ? new Date() : null })
    .where(and(eq(disciplineCases.id, caseId), eq(disciplineCases.schoolId, session.schoolId)));
  revalidateDisciplineViews();
}

export async function deleteDisciplineCaseAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const caseId = String(formData.get("caseId") || "");
  if (!caseId) return;

  await db
    .delete(disciplineCases)
    .where(and(eq(disciplineCases.id, caseId), eq(disciplineCases.schoolId, session.schoolId)));
  revalidateDisciplineViews();
}
