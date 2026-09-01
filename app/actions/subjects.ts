"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getSession } from "@/lib/session";

function revalidateSubjectViews() {
  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/grades");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function addSubjectAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/subjects?error=${encodeURIComponent("Only an admin can add subjects.")}`);
  }

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase();

  if (!name || !code) {
    redirect(`/dashboard/subjects?error=${encodeURIComponent("Subject name and code are required.")}`);
  }

  try {
    await db.insert(subjects).values({ schoolId: session.schoolId, name, code });
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(`/dashboard/subjects?error=${encodeURIComponent("That subject code is already in use.")}`);
    }
    throw err;
  }
  // No redirect: called from /dashboard/subjects itself.
  revalidateSubjectViews();
}

export async function deleteSubjectAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") return;

  const subjectId = String(formData.get("subjectId") || "");
  if (!subjectId) return;

  await db
    .delete(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, session.schoolId)));
  revalidateSubjectViews();
}
