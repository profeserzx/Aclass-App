import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, students, payments, paymentClaims, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { deletePaymentAction } from "@/app/actions/payments";
import { reviewPaymentClaimAction } from "@/app/actions/paymentClaims";
import { hasGrowthAccess } from "@/lib/plans";
import UpgradeRequired from "@/app/dashboard/UpgradeRequired";

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  bank: "Bank Transfer",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const schoolId = session.schoolId;
  const isAdmin = session.role === "admin";

  const [[school]] = await Promise.all([db.select().from(schools).where(eq(schools.id, schoolId)).limit(1)]);
  if (!hasGrowthAccess(school ?? { plan: "starter", currentPeriodEnd: null })) {
    return <UpgradeRequired feature="Fee management" isAdmin={isAdmin} />;
  }

  const [allFees, studentRows, allPayments, [{ value: totalCollected }], [{ value: mpesaTotal }], pendingClaims] =
    await Promise.all([
      db.select().from(fees).where(eq(fees.schoolId, schoolId)),
      db.select().from(students).where(eq(students.schoolId, schoolId)),
      db
        .select()
        .from(payments)
        .innerJoin(fees, eq(payments.feeId, fees.id))
        .where(eq(fees.schoolId, schoolId))
        .orderBy(desc(payments.paidAt)),
      db
        .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .innerJoin(fees, eq(payments.feeId, fees.id))
        .where(eq(fees.schoolId, schoolId)),
      db
        .select({ value: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .innerJoin(fees, eq(payments.feeId, fees.id))
        .where(sql`${fees.schoolId} = ${schoolId} and ${payments.method} = 'mpesa'`),
      isAdmin
        ? db
            .select({
              id: paymentClaims.id,
              amount: paymentClaims.amount,
              method: paymentClaims.method,
              transactionRef: paymentClaims.transactionRef,
              createdAt: paymentClaims.createdAt,
              feeDescription: fees.description,
              studentFirst: students.firstName,
              studentLast: students.lastName,
            })
            .from(paymentClaims)
            .innerJoin(fees, eq(paymentClaims.feeId, fees.id))
            .innerJoin(students, eq(fees.studentId, students.id))
            .where(and(eq(paymentClaims.schoolId, schoolId), eq(paymentClaims.status, "pending")))
            .orderBy(desc(paymentClaims.createdAt))
        : Promise.resolve([]),
    ]);

  const studentNameById = new Map(studentRows.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  const paidByFee = new Map<string, number>();
  for (const row of allPayments) {
    const feeId = row.payments.feeId;
    paidByFee.set(feeId, (paidByFee.get(feeId) ?? 0) + Number(row.payments.amount));
  }
  const totalPending = allFees
    .filter((f) => f.status !== "paid")
    .reduce((sum, f) => sum + Math.max(Number(f.amount) - (paidByFee.get(f.id) ?? 0), 0), 0);

  const stats = [
    { label: "Collected", value: `KES ${totalCollected.toLocaleString()}` },
    { label: "Outstanding", value: `KES ${totalPending.toLocaleString()}` },
    { label: "M-Pesa total", value: `KES ${mpesaTotal.toLocaleString()}` },
    { label: "Transactions", value: allPayments.length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-white/50">
          A record of payments made against fees. Payments themselves are made from the parent side.
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Pending payment claims</h2>
            <span className="text-sm text-white/40">{pendingClaims.length} awaiting review</span>
          </div>
          <p className="mt-1 text-sm text-white/50">
            Parents submitted these as paid via M-Pesa or bank transfer — verify the reference against your
            statement before approving.
          </p>
          {pendingClaims.length === 0 ? (
            <p className="mt-4 text-sm text-white/40">Nothing to review right now.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Student</th>
                    <th className="pb-2 font-normal">Fee</th>
                    <th className="pb-2 font-normal">Amount</th>
                    <th className="pb-2 font-normal">Method</th>
                    <th className="pb-2 font-normal">Ref</th>
                    <th className="pb-2 font-normal">Submitted</th>
                    <th className="pb-2 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingClaims.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0 align-top">
                      <td className="py-2.5">
                        {c.studentFirst} {c.studentLast}
                      </td>
                      <td className="py-2.5 text-white/60">{c.feeDescription}</td>
                      <td className="py-2.5 text-white/60">KES {Number(c.amount).toLocaleString()}</td>
                      <td className="py-2.5 text-white/60">{METHOD_LABELS[c.method] ?? c.method}</td>
                      <td className="py-2.5 text-white/60">{c.transactionRef}</td>
                      <td className="py-2.5 text-white/60">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-3">
                          <form action={reviewPaymentClaimAction}>
                            <input type="hidden" name="claimId" value={c.id} />
                            <input type="hidden" name="decision" value="approved" />
                            <button type="submit" className="text-emerald-400 hover:text-emerald-300">
                              Approve
                            </button>
                          </form>
                          <form action={reviewPaymentClaimAction} className="flex items-center gap-2">
                            <input type="hidden" name="claimId" value={c.id} />
                            <input type="hidden" name="decision" value="rejected" />
                            <input
                              name="reviewNote"
                              placeholder="Reason (optional)"
                              className="w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30 outline-none focus:border-accent"
                            />
                            <button type="submit" className="text-red-400 hover:text-red-300">
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-sm text-white/50">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Payment history</h2>
        {allPayments.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No payments recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Student</th>
                  <th className="pb-2 font-normal">Fee</th>
                  <th className="pb-2 font-normal">Amount</th>
                  <th className="pb-2 font-normal">Method</th>
                  <th className="pb-2 font-normal">Ref</th>
                  <th className="pb-2 font-normal">Date</th>
                  {isAdmin && <th className="pb-2 font-normal"></th>}
                </tr>
              </thead>
              <tbody>
                {allPayments.map((row) => (
                  <tr key={row.payments.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">{studentNameById.get(row.fees.studentId) ?? "—"}</td>
                    <td className="py-2.5 text-white/60">{row.fees.description}</td>
                    <td className="py-2.5 text-white/60">
                      KES {Number(row.payments.amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-white/60">
                      {METHOD_LABELS[row.payments.method] ?? row.payments.method}
                    </td>
                    <td className="py-2.5 text-white/60">{row.payments.transactionRef ?? "—"}</td>
                    <td className="py-2.5 text-white/60">
                      {new Date(row.payments.paidAt).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 text-right">
                        <form action={deletePaymentAction}>
                          <input type="hidden" name="paymentId" value={row.payments.id} />
                          <button type="submit" className="text-red-400 hover:text-red-300">
                            Delete
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
