import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, students } from "@/db/schema";
import { getSession } from "@/lib/session";
import { initiatePlatformSubscriptionPaymentAction } from "@/app/actions/billing";
import { PLAN_PRICE_KES, STARTER_STUDENT_LIMIT, hasGrowthAccess, studentLimitFor } from "@/lib/plans";
import PlatformStkStatusPoller from "@/app/dashboard/billing/PlatformStkStatusPoller";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  district: "District",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { error?: string; platformStkPushId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [[school], [{ value: studentCount }]] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1),
    db.select({ value: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, session.schoolId)),
  ]);

  const onGrowth = hasGrowthAccess(school);
  const limit = studentLimitFor(school);
  const periodEndLabel = school?.currentPeriodEnd
    ? new Date(school.currentPeriodEnd).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-white/50">Your Aclass subscription — plan, status, and payment.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Current plan</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              onGrowth ? "bg-emerald-500/15 text-emerald-300" : "bg-yellow-500/15 text-yellow-300"
            }`}
          >
            {PLAN_LABELS[school?.plan ?? "starter"]}
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-white/50">Students</div>
            <div className="mt-1 text-xl font-semibold tracking-tight">
              {studentCount}
              {limit !== null && <span className="text-sm font-normal text-white/40"> / {limit}</span>}
            </div>
          </div>
          <div>
            <div className="text-sm text-white/50">Subscription status</div>
            <div className="mt-1 text-xl font-semibold tracking-tight capitalize">
              {onGrowth ? "Active" : school?.subscriptionStatus === "past_due" ? "Past due" : "None"}
            </div>
          </div>
          {periodEndLabel && (
            <div>
              <div className="text-sm text-white/50">{onGrowth ? "Renews" : "Expired"}</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">{periodEndLabel}</div>
            </div>
          )}
        </div>

        {!onGrowth && (
          <p className="mt-4 text-sm text-white/50">
            On Starter, you're capped at {STARTER_STUDENT_LIMIT} students and don't have access to the parent
            portal, M-Pesa fee collection, or the analytics chart on Overview. Upgrade to Growth to unlock all of
            it.
          </p>
        )}
      </div>

      {!onGrowth && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">Upgrade to Growth — KES {PLAN_PRICE_KES.growth.toLocaleString()}/month</h2>
          <p className="mt-1 text-sm text-white/50">
            Unlocks the parent portal, M-Pesa fee collection, unlimited students, and analytics. Enter your own
            M-Pesa number below — you'll get a PIN prompt on your phone to complete the payment.
          </p>
          {searchParams.error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {searchParams.error}
            </div>
          )}
          <form action={initiatePlatformSubscriptionPaymentAction} className="mt-4 flex max-w-md gap-3">
            <input type="hidden" name="plan" value="growth" />
            <input
              name="phoneNumber"
              placeholder="0712345678"
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Pay with M-Pesa
            </button>
          </form>
          {searchParams.platformStkPushId && <PlatformStkStatusPoller requestId={searchParams.platformStkPushId} />}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Need District, or a different plan?</h2>
        <p className="mt-1 text-sm text-white/50">
          District pricing is custom — reach out to us directly and we'll set it up for you.
        </p>
      </div>
    </div>
  );
}
