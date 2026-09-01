import type { schools } from "@/db/schema";

type School = typeof schools.$inferSelect;

// Mirrors the pricing table on the landing page. Keep these two in sync.
export const PLAN_PRICE_KES: Record<"growth", number> = {
  growth: 15000,
};

export const STARTER_STUDENT_LIMIT = 150;

/**
 * Whether a school currently has Growth-tier access (parent portal, M-Pesa
 * fee collection, analytics). Computed live from plan + currentPeriodEnd
 * rather than trusting subscriptionStatus alone, so a school whose period
 * quietly lapsed doesn't keep Growth access just because nothing flipped
 * subscriptionStatus back to "past_due" yet.
 */
export function hasGrowthAccess(school: Pick<School, "plan" | "currentPeriodEnd">): boolean {
  if (school.plan === "district") return true; // custom-managed, not metered here
  if (school.plan === "growth") {
    return !!school.currentPeriodEnd && new Date(school.currentPeriodEnd) > new Date();
  }
  return false;
}

/** null = unlimited. */
export function studentLimitFor(school: Pick<School, "plan">): number | null {
  if (school.plan === "starter") return STARTER_STUDENT_LIMIT;
  return null;
}
