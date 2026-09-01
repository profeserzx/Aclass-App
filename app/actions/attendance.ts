"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendance, classes, students } from "@/db/schema";

import { getSession } from "@/lib/session";

const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

function canRecord(role: string): boolean {
  return role === "admin" || role === "teacher";
}

export async function markAttendanceAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");
  if (!canRecord(session.role)) {
    redirect(`/dashboard/attendance?error=${encodeURIComponent("Only an admin or teacher can mark attendance.")}`);
  }

  const classId = String(formData.get("classId") || "").trim();
  const date = String(formData.get("date") || "").trim();

  if (!classId || !date) {
    redirect(`/dashboard/attendance?error=${encodeURIComponent("Choose a class and date.")}`);
  }

  // Verify the class actually belongs to this school before writing anything.
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, session.schoolId)))
    .limit(1);
  if (!cls) {
    redirect(`/dashboard/attendance?error=${encodeURIComponent("That class was not found.")}`);
  }

  // Only students that are actually in this class + school can be marked —
  // never trust a client-supplied studentId on its own.
  const classStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.schoolId, session.schoolId)));
  const validStudentIds = new Set(classStudents.map((s) => s.id));

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const studentId = key.slice("status_".length);
    const statusValue = String(value);
    if (!validStudentIds.has(studentId)) continue;
    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(statusValue)) continue;
    const status = statusValue as AttendanceStatus;

    await db
      .insert(attendance)
      .values({ studentId, classId, date, status, recordedBy: session.userId })
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.date],
        set: { status, classId, recordedBy: session.userId },
      });
  }

  // No redirect — called from /dashboard/attendance itself, which already
  // carries ?classId=&date= in its URL.
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/parent");
}
