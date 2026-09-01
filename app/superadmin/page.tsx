import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, students } from "@/db/schema";
import { overrideSchoolPlanAction } from "@/app/actions/superadmin";
import { hasGrowthAccess } from "@/lib/plans";

const PLAN_LABELS: Record<string, string> = { starter: "Starter", growth: "Growth", district: "District" };

// Auth (login + the SUPERADMIN_EMAILS allowlist) is enforced once in
// app/superadmin/layout.tsx, which wraps every page under this route.
export default async function SuperadminPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [allSchools, studentCounts] = await Promise.all([
    db.select().from(schools).orderBy(desc(schools.name)),
    db.select({ schoolId: students.schoolId, value: sql<number>`count(*)::int` }).from(students).groupBy(students.schoolId),
  ]);

  const countBySchool = new Map(studentCounts.map((s) => [s.schoolId, s.value]));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Superadmin</h1>
        <p className="mt-1 text-sm text-white/50">Cross-school view — every Aclass tenant, at a glance.</p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">Schools</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{allSchools.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">On Growth/District</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {allSchools.filter((s) => hasGrowthAccess(s)).length}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">Total students</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {studentCounts.reduce((sum, s) => sum + s.value, 0)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium text-white">Schools</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="pb-2 font-normal">School</th>
                <th className="pb-2 font-normal">Students</th>
                <th className="pb-2 font-normal">Plan</th>
                <th className="pb-2 font-normal">Status</th>
                <th className="pb-2 font-normal">Period end</th>
                <th className="pb-2 font-normal">Override</th>
              </tr>
            </thead>
            <tbody>
              {allSchools.map((school) => {
                const active = hasGrowthAccess(school);
                return (
                  <tr key={school.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="py-3 text-white">{school.name}</td>
                    <td className="py-3 text-white/60">{countBySchool.get(school.id) ?? 0}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          active ? "bg-emerald-500/15 text-emerald-300" : "bg-yellow-500/15 text-yellow-300"
                        }`}
                      >
                        {PLAN_LABELS[school.plan]}
                      </span>
                    </td>
                    <td className="py-3 text-white/60 capitalize">{school.subscriptionStatus}</td>
                    <td className="py-3 text-white/60">
                      {school.currentPeriodEnd ? new Date(school.currentPeriodEnd).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3">
                      <form action={overrideSchoolPlanAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="schoolId" value={school.id} />
                        <select
                          name="plan"
                          defaultValue={school.plan}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-accent"
                        >
                          <option value="starter" className="bg-ink">Starter</option>
                          <option value="growth" className="bg-ink">Growth</option>
                          <option value="district" className="bg-ink">District</option>
                        </select>
                        <select
                          name="subscriptionStatus"
                          defaultValue={school.subscriptionStatus}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-accent"
                        >
                          <option value="none" className="bg-ink">None</option>
                          <option value="active" className="bg-ink">Active</option>
                          <option value="past_due" className="bg-ink">Past due</option>
                        </select>
                        <input
                          type="date"
                          name="currentPeriodEnd"
                          defaultValue={school.currentPeriodEnd ? new Date(school.currentPeriodEnd).toISOString().slice(0, 10) : ""}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-accent"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-accent2"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
