import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, students, payments, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { addFeeAction, deleteFeeAction } from "@/app/actions/fees";
import { hasGrowthAccess } from "@/lib/plans";
import UpgradeRequired from "@/app/dashboard/UpgradeRequired";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-yellow-500/15 text-yellow-300",
  partial: "bg-blue-500/15 text-blue-300",
  overdue: "bg-red-500/15 text-red-300",
};

export default async function FeesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "admin";
  const schoolId = session.schoolId;

  const [[school]] = await Promise.all([db.select().from(schools).where(eq(schools.id, schoolId)).limit(1)]);
  if (!hasGrowthAccess(school ?? { plan: "starter", currentPeriodEnd: null })) {
    return <UpgradeRequired feature="Fee management" isAdmin={isAdmin} />;
  }

  const [feeRows, studentRows, [{ value: totalFees }], [{ value: totalPaid }]] = await Promise.all([
    db
      .select()
      .from(fees)
      .where(eq(fees.schoolId, schoolId))
      .orderBy(desc(fees.createdAt)),
    db.select().from(students).where(eq(students.schoolId, schoolId)),
    db
      .select({ value: sql<number>`coalesce(sum(${fees.amount}), 0)::float` })
      .from(fees)
      .where(eq(fees.schoolId, schoolId)),
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
      .from(payments)
      .innerJoin(fees, eq(payments.feeId, fees.id))
      .where(eq(fees.schoolId, schoolId)),
  ]);

  const studentNameById = new Map(studentRows.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
  const totalPending = Math.max(totalFees - totalPaid, 0);

  const stats = [
    { label: "Total fees", value: `KES ${totalFees.toLocaleString()}` },
    { label: "Collected", value: `KES ${totalPaid.toLocaleString()}` },
    { label: "Outstanding", value: `KES ${totalPending.toLocaleString()}` },
    { label: "Records", value: feeRows.length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
        <p className="mt-1 text-sm text-white/50">Track what's owed across the school.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-white/50">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {feeRows.length === 0 ? (
            <p className="text-sm text-white/40">No fee records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Student</th>
                    <th className="pb-2 font-normal">Description</th>
                    <th className="pb-2 font-normal">Amount</th>
                    <th className="pb-2 font-normal">Due</th>
                    <th className="pb-2 font-normal">Status</th>
                    {isAdmin && <th className="pb-2 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {feeRows.map((f) => (
                    <tr key={f.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">{studentNameById.get(f.studentId) ?? "—"}</td>
                      <td className="py-2.5 text-white/60">
                        {f.description}
                        {f.term ? ` · ${f.term}` : ""}
                      </td>
                      <td className="py-2.5 text-white/60">KES {Number(f.amount).toLocaleString()}</td>
                      <td className="py-2.5 text-white/60">{f.dueDate}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            STATUS_STYLES[f.status] ?? ""
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-3">
                            <Link href={`/dashboard/fees/${f.id}/edit`} className="text-accent hover:text-accent2">
                              Edit
                            </Link>
                            <form action={deleteFeeAction}>
                              <input type="hidden" name="feeId" value={f.id} />
                              <button type="submit" className="text-red-400 hover:text-red-300">
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-medium">Add a fee record</h2>
            <form action={addFeeAction} className="mt-4 space-y-3">
              <select
                name="studentId"
                required
                defaultValue=""
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" disabled className="bg-ink">
                  Select student
                </option>
                {studentRows.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink">
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <input
                name="description"
                placeholder="Description (e.g. Term 2 tuition)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="term"
                placeholder="Term (optional)"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount (KES)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Due date</label>
                <input
                  name="dueDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>
              <select
                name="status"
                defaultValue="pending"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="pending" className="bg-ink">
                  Pending
                </option>
                <option value="partial" className="bg-ink">
                  Partial
                </option>
                <option value="paid" className="bg-ink">
                  Paid
                </option>
                <option value="overdue" className="bg-ink">
                  Overdue
                </option>
              </select>
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
              >
                Add fee record
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
