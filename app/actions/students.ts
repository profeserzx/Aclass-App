"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { provisionParentAccount } from "@/lib/parentAccount";
import { studentLimitFor } from "@/lib/plans";

/** Throws no error — just redirects with a friendly message if the school's Starter cap is hit. */
async function enforceStudentLimit(schoolId: string, addingCount: number) {
  const [[school], [{ value: currentCount }]] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, schoolId)).limit(1),
    db.select({ value: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId)),
  ]);
  const limit = studentLimitFor(school ?? { plan: "starter" });
  if (limit !== null && currentCount + addingCount > limit) {
    redirect(
      `/dashboard/students?error=${encodeURIComponent(
        `Your Starter plan is capped at ${limit} students (you have ${currentCount}). Upgrade to Growth on the Billing page to add more.`
      )}`
    );
  }
}

// Other pages read the student list too — keep them all in sync.
function revalidateStudentViews() {
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/grades");
}

function readStudentFields(formData: FormData) {
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const admissionNumber = String(formData.get("admissionNumber") || "").trim() || null;
  const guardianName = String(formData.get("guardianName") || "").trim() || null;
  const guardianContact = String(formData.get("guardianContact") || "").trim() || null;
  const guardianEmail = String(formData.get("guardianEmail") || "").trim() || null;
  const classIdRaw = String(formData.get("classId") || "").trim();
  const classId = classIdRaw.length > 0 ? classIdRaw : null;
  const dateOfBirth = String(formData.get("dateOfBirth") || "").trim() || null;
  return {
    firstName,
    lastName,
    admissionNumber,
    guardianName,
    guardianContact,
    guardianEmail,
    classId,
    dateOfBirth,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function addStudentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/students?error=${encodeURIComponent("Only an admin can add students.")}`);
  }

  const fields = readStudentFields(formData);
  if (!fields.firstName || !fields.lastName) {
    redirect(`/dashboard/students?error=${encodeURIComponent("First and last name are required.")}`);
  }

  await enforceStudentLimit(session.schoolId, 1);

  let studentId: string;
  try {
    // schoolId always comes from the verified session, never client input, so a
    // student can never be inserted into another school's tenant.
    const [created] = await db
      .insert(students)
      .values({ schoolId: session.schoolId, ...fields })
      .returning();
    studentId = created.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(
        `/dashboard/students?error=${encodeURIComponent("That admission number is already in use.")}`
      );
    }
    throw err;
  }

  // Auto-creates a parent login (admission number @ school domain, password =
  // admission number) if the school has a domain set and this student has an
  // admission number. Silently skipped otherwise — see lib/parentAccount.ts.
  await provisionParentAccount({
    schoolId: session.schoolId,
    studentId,
    admissionNumber: fields.admissionNumber,
    guardianName: fields.guardianName,
  });
  // No redirect: called from /dashboard/students itself — revalidate instead
  // so the new student shows up immediately instead of only after a refresh.
  revalidateStudentViews();
}

export async function updateStudentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/students?error=${encodeURIComponent("Only an admin can edit students.")}`);
  }

  const studentId = String(formData.get("studentId") || "");
  if (!studentId) redirect("/dashboard/students");

  const fields = readStudentFields(formData);
  if (!fields.firstName || !fields.lastName) {
    redirect(
      `/dashboard/students/${studentId}/edit?error=${encodeURIComponent("First and last name are required.")}`
    );
  }

  try {
    // The schoolId check in the WHERE clause means this update is a no-op if the
    // student doesn't belong to the logged-in admin's school.
    await db
      .update(students)
      .set(fields)
      .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)));
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(
        `/dashboard/students/${studentId}/edit?error=${encodeURIComponent(
          "That admission number is already in use."
        )}`
      );
    }
    throw err;
  }

  revalidateStudentViews();
  // This one does need to redirect — it's called from the edit page, which is
  // a different route than the students list we're sending the admin back to.
  redirect("/dashboard/students");
}

export async function deleteStudentAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const studentId = String(formData.get("studentId") || "");
  if (!studentId) return;

  await db
    .delete(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, session.schoolId)));
  revalidateStudentViews();
}
