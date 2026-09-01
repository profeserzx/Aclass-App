"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { requireSuperadmin } from "@/lib/superadmin";

/**
 * Manual safety-valve override — lets us fix a school's plan/status by hand
 * (e.g. a webhook never arrived, or a school is being invoiced/comped outside
 * the normal M-Pesa flow) without touching the database directly.
 */
export async function overrideSchoolPlanAction(formData: FormData) {
  await requireSuperadmin();

  const schoolId = String(formData.get("schoolId") || "").trim();
  const plan = String(formData.get("plan") || "").trim();
  const subscriptionStatus = String(formData.get("subscriptionStatus") || "").trim();
  const currentPeriodEndRaw = String(formData.get("currentPeriodEnd") || "").trim();

  if (!schoolId || !["starter", "growth", "district"].includes(plan) || !["active", "past_due", "none"].includes(subscriptionStatus)) {
    redirect(`/superadmin?error=${encodeURIComponent("Invalid plan override submitted.")}`);
  }

  await db
    .update(schools)
    .set({
      plan: plan as "starter" | "growth" | "district",
      subscriptionStatus: subscriptionStatus as "active" | "past_due" | "none",
      currentPeriodEnd: currentPeriodEndRaw ? new Date(currentPeriodEndRaw) : null,
    })
    .where(eq(schools.id, schoolId));

  revalidatePath("/superadmin");
  redirect("/superadmin");
}
