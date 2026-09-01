"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { studentSubjects, students, subjects } from "@/db/schema";
import { getSession } from "@/lib/session";

function canManage(role: string): boolean {
  return role === "admin" || role === "teacher" || role === "dean";
}

export async function setStudentSubjectsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const studentId = String(formData.get("studentId") || "").trim();
  const backParams = `entryStudentId=${encodeURIComponent(studentId)}`;

  if (!canManage(session.role)) {
    redirect(`/dashboard/grades?${backParams}&error=${encodeURIComponent("Only an admin, teacher, or dean can set a student's subjects.")}`);
  }
  if (!studentId) {
    redirect(`/dashboard/grades?error=${encodeURIComponent("Choose a student first.")}`);
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

  const submittedSubjectIds = formData.getAll("subjectIds").map(String);

  // Only accept subject ids that actually belong to this school — never
  // trust client-supplied ids on their own.
  const validSubjects =
    submittedSubjectIds.length === 0
      ? []
      : await db
          .select({ id: subjects.id })
          .from(subjects)
          .where(and(eq(subjects.schoolId, session.schoolId), inArray(subjects.id, submittedSubjectIds)));

  await db.delete(studentSubjects).where(eq(studentSubjects.studentId, studentId));

  if (validSubjects.length > 0) {
    await db.insert(studentSubjects).values(validSubjects.map((s) => ({ studentId, subjectId: s.id })));
  }

  // No redirect — called from /dashboard/grades itself.
  revalidatePath("/dashboard/grades");
}
