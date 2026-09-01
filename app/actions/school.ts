"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";

export async function updateSchoolDomainAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard?error=${encodeURIComponent("Only an admin can change the school domain.")}`);
  }

  let domain = String(formData.get("domain") || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // If someone pastes a full example login (e.g. "1834@dawamu.ac.ke") instead
  // of just the domain, keep only the part after the last "@" — this is the
  // exact mistake that previously produced double-prefixed logins like
  // "1835@1835@dawamu.ac.ke".
  if (domain.includes("@")) {
    domain = domain.split("@").pop() || "";
  }

  if (!domain || !domain.includes(".") || domain.includes("@")) {
    redirect(
      `/dashboard?error=${encodeURIComponent("Enter just the domain, e.g. dawamu.ac.ke (no admission number or @).")}`
    );
  }

  await db.update(schools).set({ domain }).where(eq(schools.id, session.schoolId));
  // No redirect: called from /dashboard itself.
  revalidatePath("/dashboard");
}

export async function updateSchoolTaglineAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard?error=${encodeURIComponent("Only an admin can change the school tagline.")}`);
  }

  const tagline = String(formData.get("tagline") || "").trim().slice(0, 255) || null;

  await db.update(schools).set({ tagline }).where(eq(schools.id, session.schoolId));
  // No redirect: called from /dashboard itself.
  revalidatePath("/dashboard");
}

/**
 * Lets each school plug in their OWN Safaricom Paybill/Till + Daraja app, so
 * parent M-Pesa payments land in that school's own account rather than a
 * shared one. Consumer Secret and Passkey are encrypted before storage
 * (see lib/crypto.ts) — leave either blank on an edit to keep the existing
 * stored value (so re-saving the shortcode doesn't force re-entering secrets).
 */
export async function updateMpesaSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard?error=${encodeURIComponent("Only an admin can change M-Pesa settings.")}`);
  }

  const env = String(formData.get("mpesaEnv") || "sandbox") === "production" ? "production" : "sandbox";
  const shortcode = String(formData.get("mpesaShortcode") || "").trim();
  const consumerKey = String(formData.get("mpesaConsumerKey") || "").trim();
  const consumerSecret = String(formData.get("mpesaConsumerSecret") || "").trim();
  const passkey = String(formData.get("mpesaPasskey") || "").trim();

  const [existing] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);

  await db
    .update(schools)
    .set({
      mpesaEnv: env,
      mpesaShortcode: shortcode || null,
      mpesaConsumerKey: consumerKey || null,
      // Blank means "leave unchanged" — only overwrite if something was typed.
      mpesaConsumerSecret: consumerSecret ? encryptSecret(consumerSecret) : existing?.mpesaConsumerSecret,
      mpesaPasskey: passkey ? encryptSecret(passkey) : existing?.mpesaPasskey,
    })
    .where(eq(schools.id, session.schoolId));

  // No redirect: called from /dashboard itself.
  revalidatePath("/dashboard");
}
