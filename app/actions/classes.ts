"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import { getSession } from "@/lib/session";

function revalidateClassViews() {
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/grades");
  revalidatePath("/dashboard");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function createClassAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/classes?error=${encodeURIComponent("Only an admin can create classes.")}`);
  }

  const name = String(formData.get("name") || "").trim();
  // Custom grade level (free text) wins over the curated dropdown if filled in.
  const gradeLevelCustom = String(formData.get("gradeLevelCustom") || "").trim();
  const gradeLevelPreset = String(formData.get("gradeLevel") || "").trim();
  const gradeLevel = gradeLevelCustom || gradeLevelPreset || null;
  const teacherIdRaw = String(formData.get("teacherId") || "").trim();
  const teacherId = teacherIdRaw.length > 0 ? teacherIdRaw : null;

  if (!name) {
    redirect(`/dashboard/classes?error=${encodeURIComponent("Give the class a name, e.g. 'Grade 7 East'.")}`);
  }

  try {
    await db.insert(classes).values({ schoolId: session.schoolId, name, gradeLevel, teacherId });
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(`/dashboard/classes?error=${encodeURIComponent("A class with that name already exists.")}`);
    }
    throw err;
  }
  revalidateClassViews();
}

export async function updateClassAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/classes?error=${encodeURIComponent("Only an admin can edit classes.")}`);
  }

  const classId = String(formData.get("classId") || "");
  if (!classId) redirect("/dashboard/classes");

  const name = String(formData.get("name") || "").trim();
  const gradeLevelCustom = String(formData.get("gradeLevelCustom") || "").trim();
  const gradeLevelPreset = String(formData.get("gradeLevel") || "").trim();
  const gradeLevel = gradeLevelCustom || gradeLevelPreset || null;
  const teacherIdRaw = String(formData.get("teacherId") || "").trim();
  const teacherId = teacherIdRaw.length > 0 ? teacherIdRaw : null;

  if (!name) {
    redirect(`/dashboard/classes?error=${encodeURIComponent("Give the class a name, e.g. 'Grade 7 East'.")}`);
  }

  try {
    await db
      .update(classes)
      .set({ name, gradeLevel, teacherId })
      .where(and(eq(classes.id, classId), eq(classes.schoolId, session.schoolId)));
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(`/dashboard/classes?error=${encodeURIComponent("A class with that name already exists.")}`);
    }
    throw err;
  }
  revalidateClassViews();
}

export async function deleteClassAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const classId = String(formData.get("classId") || "");
  if (!classId) return;

  // Students in this class aren't deleted — classId just gets cleared (see
  // students.classId onDelete: "set null") so nobody's record disappears
  // because a class was renamed away or removed.
  await db.delete(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, session.schoolId)));
  revalidateClassViews();
}

/**
 * Assigns (or clears) a student's class. Admin and dean can do this for any
 * student/class in the school; a teacher can only place a student into — or
 * remove them from — a class where that teacher is the class's own teacher
 * (classes.teacherId), matching "class teacher" responsibilities rather than
 * giving every teacher free rein over the whole school's class rosters.
 */
export async function assignStudentClassAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["admin", "dean", "teacher"].includes(session.role)) return;

  const studentId = String(formData.get("studentId") || "");
  const classIdRaw = String(formData.get("classId") || "").trim();
  const classId = classIdRaw.length > 0 ? classIdRaw : null;
  if (!studentId) return;

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)))
    .limit(1);
  if (!student) return;

  if (session.role === "teacher") {
    if (classId) {
      const [targetClass] = await db
        .select()
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.schoolId, session.schoolId)))
        .limit(1);
      if (!targetClass || targetClass.teacherId !== session.userId) return;
    } else if (student.classId) {
      const [currentClass] = await db.select().from(classes).where(eq(classes.id, student.classId)).limit(1);
      if (!currentClass || currentClass.teacherId !== session.userId) return;
    }
  } else if (classId) {
    // Still verify the target class actually belongs to this school.
    const [targetClass] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, session.schoolId)))
      .limit(1);
    if (!targetClass) return;
  }

  await db.update(students).set({ classId }).where(eq(students.id, studentId));
  revalidateClassViews();
}
