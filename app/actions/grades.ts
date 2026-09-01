"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades, students, subjects } from "@/db/schema";
import { getSession } from "@/lib/session";

function revalidateGradeViews() {
  revalidatePath("/dashboard/grades");
  revalidatePath("/parent");
}

// Admin is view-only for grades — entry is done by teachers and the dean.
function canRecord(role: string): boolean {
  return role === "teacher" || role === "dean";
}

// Enter one student's scores across every subject at once (one row per
// subject in the form), instead of submitting a separate form per subject.
export async function enterGradesAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const studentId = String(formData.get("studentId") || "").trim();
  const term = String(formData.get("term") || "").trim();
  const backParams = `entryStudentId=${encodeURIComponent(studentId)}&entryTerm=${encodeURIComponent(term)}`;

  if (!canRecord(session.role)) {
    redirect(`/dashboard/grades?${backParams}&error=${encodeURIComponent("Only a teacher or the dean can enter grades.")}`);
  }
  if (!studentId || !term) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Choose a student and a term.")}`);
  }

  // Verify the student actually belongs to this school before writing.
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("That student was not found.")}`);
  }

  const subjectRows = await db.select().from(subjects).where(eq(subjects.schoolId, session.schoolId));

  const entries: { subject: string; score: string; maxScore: string }[] = [];
  for (const subj of subjectRows) {
    const scoreRaw = String(formData.get(`score_${subj.id}`) || "").trim();
    if (!scoreRaw) continue; // subject left blank — skip it, not every subject needs a score every time
    const maxScoreRaw = String(formData.get(`max_${subj.id}`) || "").trim() || "100";

    const score = Number(scoreRaw);
    const maxScore = Number(maxScoreRaw);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
      redirect(
        `/dashboard/grades?${backParams}&error=${encodeURIComponent(`${subj.name}: score and max score must be valid numbers.`)}`
      );
    }
    if (score < 0 || score > maxScore) {
      redirect(
        `/dashboard/grades?${backParams}&error=${encodeURIComponent(`${subj.name}: score can't be negative or higher than the max score.`)}`
      );
    }
    entries.push({ subject: subj.name, score: scoreRaw, maxScore: maxScoreRaw });
  }

  if (entries.length === 0) {
    redirect(`/dashboard/grades?${backParams}&error=${encodeURIComponent("Enter a score for at least one subject.")}`);
  }

  for (const entry of entries) {
    await db
      .insert(grades)
      .values({
        studentId,
        subject: entry.subject,
        term,
        score: entry.score,
        maxScore: entry.maxScore,
        recordedBy: session.userId,
      })
      .onConflictDoUpdate({
        target: [grades.studentId, grades.subject, grades.term],
        set: { score: entry.score, maxScore: entry.maxScore, recordedBy: session.userId },
      });
  }

  // No redirect — called from /dashboard/grades itself (stays on the same
  // ?entryStudentId=&entryTerm= URL the grid was loaded from).
  revalidateGradeViews();
}

export async function upsertGradeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");
  if (!canRecord(session.role)) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Only a teacher or the dean can enter grades.")}`);
  }

  const studentId = String(formData.get("studentId") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const term = String(formData.get("term") || "").trim();
  const scoreRaw = String(formData.get("score") || "").trim();
  const maxScoreRaw = String(formData.get("maxScore") || "").trim() || "100";

  if (!studentId || !subject || !term || !scoreRaw) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Student, subject, term, and score are required.")}`);
  }

  const score = Number(scoreRaw);
  const maxScore = Number(maxScoreRaw);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Score and max score must be valid numbers.")}`);
  }
  if (score < 0 || score > maxScore) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Score can't be negative or higher than the max score.")}`);
  }

  // Verify the student actually belongs to this school before writing.
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("That student was not found.")}`);
  }

  await db
    .insert(grades)
    .values({
      studentId,
      subject,
      term,
      score: scoreRaw,
      maxScore: maxScoreRaw,
      recordedBy: session.userId,
    })
    .onConflictDoUpdate({
      target: [grades.studentId, grades.subject, grades.term],
      set: { score: scoreRaw, maxScore: maxScoreRaw, recordedBy: session.userId },
    });

  // No redirect — called from /dashboard/grades itself.
  revalidateGradeViews();
}

export async function deleteGradeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const gradeId = String(formData.get("gradeId") || "");
  if (!gradeId) return;

  const [row] = await db
    .select({ id: grades.id, studentId: grades.studentId })
    .from(grades)
    .where(eq(grades.id, gradeId))
    .limit(1);
  if (!row) return;

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, row.studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) return;

  await db.delete(grades).where(eq(grades.id, gradeId));
  revalidateGradeViews();
}
