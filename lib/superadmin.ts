import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";

// Superadmin isn't a DB role — it's a small email allowlist (SUPERADMIN_EMAILS
// in .env.local, comma-separated) gating the one route in this app that reads
// across ALL schools instead of scoping by session.schoolId.
export function isSuperadminEmail(email: string): boolean {
  const raw = process.env.SUPERADMIN_EMAILS || "";
  const allowlist = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

/** Shared by both /superadmin (the page) and its server actions. Redirects away, never throws. */
export async function requireSuperadmin() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !isSuperadminEmail(user.email)) redirect("/dashboard");

  return session;
}
