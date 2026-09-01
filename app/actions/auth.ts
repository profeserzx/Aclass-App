"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, users } from "@/db/schema";
import { createSessionToken, hashPassword, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie, getSession } from "@/lib/session";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isRateLimited, recordAttempt } from "@/lib/rateLimit";

/** Best-effort client IP from the proxy headers — "unknown" locally, where there's no proxy setting them. */
function clientIp(): string {
  const forwardedFor = headers().get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers().get("x-real-ip") || "unknown";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function signupAction(formData: FormData) {
  const schoolName = String(formData.get("schoolName") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const agreedToTerms = formData.get("agreeToTerms") === "on";

  if (!schoolName || !adminName || !email || !password) {
    redirect(`/signup?error=${encodeURIComponent("All fields are required.")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  if (!agreedToTerms) {
    redirect(`/signup?error=${encodeURIComponent("You must agree to the Terms of Service and Privacy Policy to continue.")}`);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  let slug = slugify(schoolName) || "school";
  const slugTaken = await db.select().from(schools).where(eq(schools.slug, slug)).limit(1);
  if (slugTaken.length > 0) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const [school] = await db.insert(schools).values({ name: schoolName, slug }).returning();

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      schoolId: school.id,
      name: adminName,
      email,
      passwordHash,
      role: "admin",
    })
    .returning();

  const token = await createSessionToken({
    userId: user.id,
    schoolId: school.id,
    role: "admin",
    name: adminName,
  });
  setSessionCookie(token);
  // A superadmin account still belongs to a (throwaway) school like anyone
  // else, but they land on the cross-school control panel first — their own
  // school's dashboard is one click away from there.
  redirect(isSuperadminEmail(email) ? "/superadmin" : "/dashboard");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  // Locks out further attempts on this email OR this IP after 5 failures in
  // 15 minutes — whichever limit is hit first. Checked before touching the
  // database or hashing anything, so a lockout doesn't cost extra bcrypt work.
  const emailKey = `login:${email}`;
  const ipKey = `login-ip:${clientIp()}`;
  const RATE_LIMIT = { maxAttempts: 5, windowMinutes: 15 };
  if ((await isRateLimited(emailKey, RATE_LIMIT)) || (await isRateLimited(ipKey, RATE_LIMIT))) {
    redirect(`/login?error=${encodeURIComponent("Too many attempts. Try again in a few minutes.")}`);
  }

  // The same email can exist at more than one school — users.email is only
  // unique per (schoolId, email), not globally (see emailPerSchoolIdx in
  // schema.ts). Grabbing an arbitrary first match here would either reject a
  // correct password (wrong row picked) or, worse, log someone into a
  // different school's account. Check every matching row's password instead,
  // same principle already used in the forgot-password flow.
  const candidates = await db.select().from(users).where(eq(users.email, email));

  let user: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.passwordHash)) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    await Promise.all([recordAttempt(emailKey), recordAttempt(ipKey)]);
    redirect(`/login?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  const token = await createSessionToken({
    userId: user.id,
    schoolId: user.schoolId,
    role: user.role,
    name: user.name,
  });
  setSessionCookie(token);
  if (isSuperadminEmail(user.email)) redirect("/superadmin");
  redirect(user.role === "parent" ? "/parent" : "/dashboard");
}

export async function logoutAction() {
  clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const backTo = session.role === "parent" ? "/parent" : "/dashboard/account";

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect(`${backTo}?error=${encodeURIComponent("Fill in all password fields.")}`);
  }
  if (newPassword.length < 8) {
    redirect(`${backTo}?error=${encodeURIComponent("New password must be at least 8 characters.")}`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`${backTo}?error=${encodeURIComponent("New passwords don't match.")}`);
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/login");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    redirect(`${backTo}?error=${encodeURIComponent("Current password is incorrect.")}`);
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.userId));
  // No further redirect needed — called from the same page.
}
