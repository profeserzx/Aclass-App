"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

const STAFF_ROLES = ["teacher", "dean", "deputy_principal"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function createStaffAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Only an admin can add staff.")}`);
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const roleRaw = String(formData.get("role") || "");

  if (!name || !email || !password) {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Name, email, and password are required.")}`);
  }
  if (password.length < 8) {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  if (!STAFF_ROLES.includes(roleRaw as StaffRole)) {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Choose a valid staff role.")}`);
  }
  const role = roleRaw as StaffRole;

  const passwordHash = await hashPassword(password);

  try {
    await db.insert(users).values({
      schoolId: session.schoolId,
      name,
      email,
      passwordHash,
      role,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      redirect(`/dashboard/staff?error=${encodeURIComponent("That email is already registered.")}`);
    }
    throw err;
  }
  // Called from /dashboard/staff itself — revalidate so the new staff member
  // shows up immediately instead of only after a manual refresh.
  revalidatePath("/dashboard/staff");
}

export async function deleteStaffAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Only an admin can remove staff.")}`);
  }

  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  // Scoped to this school, and explicitly excludes the admin role — the main
  // admin account can never be removed through this action, no matter what.
  await db
    .delete(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.schoolId, session.schoolId),
        ne(users.role, "admin")
      )
    );
  revalidatePath("/dashboard/staff");
}
