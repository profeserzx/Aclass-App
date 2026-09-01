import { Fragment } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, fees, payments, attendance, grades, emailLogs, users, paymentClaims, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { changePasswordAction } from "@/app/actions/auth";
import { submitPaymentClaimAction, cancelPaymentClaimAction } from "@/app/actions/paymentClaims";
import { initiateMpesaPaymentAction } from "@/app/actions/mpesa";
import { kcseGrade, meanGrade } from "@/lib/grading";
import MpesaStatusPoller from "@/app/parent/MpesaStatusPoller";
import { hasGrowthAccess } from "@/lib/plans";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-yellow-500/15 text-yellow-300",
  partial: "bg-blue-500/15 text-blue-300",
  overdue: "bg-red-500/15 text-red-300",
};

const CLAIM_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
};

const ATTENDANCE_STYLES: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-300",
  absent: "bg-red-500/15 text-red-300",
  late: "bg-yellow-500/15 text-yellow-300",
  excused: "bg-blue-500/15 text-blue-300",
};

export default async function ParentPage({
  searchParams,
}: {
  searchParams: { error?: string; stkPushId?: string };
}) {
  const session = await getSession();
  if (!session || session.role !== "parent") redirect("/login");

  const [school] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);
  if (!school || !hasGrowthAccess(school)) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">
        <h1 className="text-lg font-medium text-white">Parent portal not available yet</h1>
        <p className="mt-2 max-w-md">
          Your school hasn't upgraded to the Growth plan yet, which is what turns on the parent portal. Ask the
          school office about it, or check back later.
        </p>
      </div>
    );
  }

  const [child] = await db.select().from(students).where(eq(students.userId, session.userId)).limit(1);

  if (!child) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">
        We couldn't find a student linked to this account yet. Ask the school office to check the link.
      </div>
    );
  }

  const [studentClass, childFees, childPayments, childAttendance, childGrades, childMessages, childClaims] = await Promise.all([
    child.classId ? db.select().from(classes).where(eq(classes.id, child.classId)).limit(1) : Promise.resolve([]),
    db.select().from(fees).where(eq(fees.studentId, child.id)).orderBy(desc(fees.dueDate)),
    db
      .select()
      .from(payments)
      .innerJoin(fees, eq(payments.feeId, fees.id))
      .where(eq(fees.studentId, child.id))
      .orderBy(desc(payments.paidAt)),
    db.select().from(attendance).where(eq(attendance.studentId, child.id)).orderBy(desc(attendance.date)),
    db.select().from(grades).where(eq(grades.studentId, child.id)).orderBy(desc(grades.createdAt)),
    child.guardianEmail
      ? db
          .select({
            id: emailLogs.id,
            subject: emailLogs.subject,
            body: emailLogs.body,
            createdAt: emailLogs.createdAt,
            senderName: users.name,
          })
          .from(emailLogs)
          .leftJoin(users, eq(emailLogs.sentBy, users.id))
          .where(
            and(
              eq(emailLogs.schoolId, session.schoolId),
              eq(emailLogs.recipientEmail, child.guardianEmail),
              eq(emailLogs.status, "sent")
            )
          )
          .orderBy(desc(emailLogs.createdAt))
          .limit(50)
      : Promise.resolve([]),
    db
      .select({
        id: paymentClaims.id,
        amount: paymentClaims.amount,
        method: paymentClaims.method,
        transactionRef: paymentClaims.transactionRef,
        status: paymentClaims.status,
        reviewNote: paymentClaims.reviewNote,
        createdAt: paymentClaims.createdAt,
        feeDescription: fees.description,
      })
      .from(paymentClaims)
      .innerJoin(fees, eq(paymentClaims.feeId, fees.id))
      .where(eq(fees.studentId, child.id))
      .orderBy(desc(paymentClaims.createdAt)),
  ]);

  const unpaidFees = childFees.filter((f) => f.status !== "paid");

  const totalFees = childFees.reduce((sum, f) => sum + Number(f.amount), 0);
  const totalPaid = childPayments.reduce((sum, p) => sum + Number(p.payments.amount), 0);
  const totalPending = Math.max(totalFees - totalPaid, 0);

  const attendanceRate =
    childAttendance.length > 0
      ? Math.round(
          (childAttendance.filter((a) => a.status === "present" || a.status === "late").length /
            childAttendance.length) *
            100
        )
      : null;

  // Group by term so we can show a final (mean) grade per term, like a report card.
  const childGradesByTerm = new Map<string, typeof childGrades>();
  for (const g of childGrades) {
    if (!childGradesByTerm.has(g.term)) childGradesByTerm.set(g.term, []);
    childGradesByTerm.get(g.term)!.push(g);
  }

  const childOverallGrade = meanGrade(
    childGrades.map((g) => kcseGrade((Number(g.score) / Number(g.maxScore)) * 100).points)
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm text-white/50">Student</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {child.firstName} {child.lastName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/60">
          <span>Admission #{child.admissionNumber ?? "—"}</span>
          <span>{studentClass[0]?.name ?? "No class assigned"}</span>
        </div>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Messages</h2>
        <p className="mt-1 text-sm text-white/50">
          Messages the school has sent about your child — discipline, exam results, events, and general notices.
          This is a read-only inbox; reply by phone or in person if you need to respond.
        </p>
        {!child.guardianEmail ? (
          <p className="mt-4 text-sm text-white/40">
            No email is on file for you yet — ask the school office to add one so you receive messages here.
          </p>
        ) : childMessages.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No messages yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {childMessages.map((m) => (
              <details key={m.id} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm">
                  <span className="flex-1">
                    <span className="text-white/40">{m.senderName ?? "School"} — </span>
                    {m.subject}
                  </span>
                  <span className="shrink-0 text-xs text-white/40">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </summary>
                {m.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/60">{m.body}</p>
                )}
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">Total fees</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">KES {totalFees.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">Paid</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">KES {totalPaid.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-sm text-white/50">Outstanding</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">KES {totalPending.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Fees</h2>
        {childFees.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No fee records yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Description</th>
                  <th className="pb-2 font-normal">Amount</th>
                  <th className="pb-2 font-normal">Due</th>
                  <th className="pb-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {childFees.map((f) => (
                  <tr key={f.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Pay with M-Pesa</h2>
        <p className="mt-1 text-sm text-white/50">
          Enter your Safaricom number and we'll send a payment prompt straight to your phone — no code to type
          in afterwards, it reflects automatically once you enter your PIN.
        </p>
        {unpaidFees.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No outstanding fees to pay right now.</p>
        ) : (
          <form action={initiateMpesaPaymentAction} className="mt-4 space-y-3">
            <select
              name="feeId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="" disabled className="bg-ink">
                Select the fee you're paying
              </option>
              {unpaidFees.map((f) => (
                <option key={f.id} value={f.id} className="bg-ink">
                  {f.description}
                  {f.term ? ` · ${f.term}` : ""} — KES {Number(f.amount).toLocaleString()}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="phoneNumber"
                type="tel"
                placeholder="0712345678"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="amount"
                type="number"
                step="1"
                min="1"
                placeholder="Amount (KES)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Send payment prompt
            </button>
          </form>
        )}
        {searchParams.stkPushId && <MpesaStatusPoller requestId={searchParams.stkPushId} />}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Report a payment</h2>
        <p className="mt-1 text-sm text-white/50">
          If M-Pesa above doesn't work for you, pay via Till/Paybill or bank transfer as usual, then submit the
          M-Pesa code or bank reference here. The office will verify it and your balance will update once
          confirmed.
        </p>
        {unpaidFees.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No outstanding fees to report a payment for.</p>
        ) : (
          <form action={submitPaymentClaimAction} className="mt-4 space-y-3">
            <select
              name="feeId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="" disabled className="bg-ink">
                Select the fee you're paying
              </option>
              {unpaidFees.map((f) => (
                <option key={f.id} value={f.id} className="bg-ink">
                  {f.description}
                  {f.term ? ` · ${f.term}` : ""} — KES {Number(f.amount).toLocaleString()}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select
                name="method"
                defaultValue="mpesa"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="mpesa" className="bg-ink">
                  M-Pesa
                </option>
                <option value="bank" className="bg-ink">
                  Bank transfer
                </option>
                <option value="cheque" className="bg-ink">
                  Cheque
                </option>
              </select>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount paid (KES)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
            </div>
            <input
              name="transactionRef"
              placeholder="M-Pesa code or bank reference"
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Submit for verification
            </button>
          </form>
        )}

        {childClaims.length > 0 && (
          <div className="mt-6 border-t border-white/5 pt-4">
            <h3 className="text-sm font-medium text-white/70">Your submitted payments</h3>
            <div className="mt-3 space-y-2">
              {childClaims.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <div>
                    <div>
                      {c.feeDescription} — KES {Number(c.amount).toLocaleString()}{" "}
                      <span className="text-xs text-white/40 capitalize">({c.method}, ref {c.transactionRef})</span>
                    </div>
                    {c.status === "rejected" && c.reviewNote && (
                      <div className="mt-1 text-xs text-red-300">Reason: {c.reviewNote}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        CLAIM_STATUS_STYLES[c.status] ?? ""
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.status === "pending" && (
                      <form action={cancelPaymentClaimAction}>
                        <input type="hidden" name="claimId" value={c.id} />
                        <button type="submit" className="text-xs text-white/40 hover:text-white">
                          Withdraw
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Payment history</h2>
        {childPayments.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No payments recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Fee</th>
                  <th className="pb-2 font-normal">Amount</th>
                  <th className="pb-2 font-normal">Method</th>
                  <th className="pb-2 font-normal">Ref</th>
                </tr>
              </thead>
              <tbody>
                {childPayments.map((row) => (
                  <tr key={row.payments.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 text-white/60">
                      {new Date(row.payments.paidAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">{row.fees.description}</td>
                    <td className="py-2.5 text-white/60">
                      KES {Number(row.payments.amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-white/60 capitalize">{row.payments.method}</td>
                    <td className="py-2.5 text-white/60">{row.payments.transactionRef ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Attendance</h2>
          {attendanceRate !== null && (
            <span className="text-sm text-white/50">{attendanceRate}% present</span>
          )}
        </div>
        {childAttendance.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No attendance recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {childAttendance.slice(0, 30).map((a) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 text-white/60">{a.date}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          ATTENDANCE_STYLES[a.status] ?? ""
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Academic results</h2>
          {childOverallGrade && (
            <span className="text-sm text-white/50">
              Mean grade: <span className="font-medium text-white">{childOverallGrade.letter}</span>{" "}
              ({childOverallGrade.points} pts)
            </span>
          )}
        </div>
        {childGrades.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">Not published yet — check back once results are added.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Subject</th>
                  <th className="pb-2 font-normal">Term</th>
                  <th className="pb-2 font-normal">Score</th>
                  <th className="pb-2 font-normal">Grade</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(childGradesByTerm.entries()).map(([term, rows]) => {
                  const final = meanGrade(
                    rows.map((g) => kcseGrade((Number(g.score) / Number(g.maxScore)) * 100).points)
                  );
                  return (
                    <Fragment key={term}>
                      {rows.map((g) => {
                        const pct = (Number(g.score) / Number(g.maxScore)) * 100;
                        const { letter, points } = kcseGrade(pct);
                        return (
                          <tr key={g.id} className="border-b border-white/5">
                            <td className="py-2.5">{g.subject}</td>
                            <td className="py-2.5 text-white/60">{g.term}</td>
                            <td className="py-2.5 text-white/60">
                              {g.score}/{g.maxScore}{" "}
                              <span className="text-xs text-white/40">({Math.round(pct)}%)</span>
                            </td>
                            <td className="py-2.5">
                              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent2">
                                {letter}
                              </span>
                              <span className="ml-1.5 text-xs text-white/40">{points} pts</span>
                            </td>
                          </tr>
                        );
                      })}
                      {final && (
                        <tr className="border-b border-white/10 bg-white/[0.04] last:border-0">
                          <td className="py-2.5 font-medium" colSpan={2}>
                            Final grade — {term}
                          </td>
                          <td className="py-2.5">
                            <a
                              href={`/api/report-card?studentId=${child.id}&term=${encodeURIComponent(term)}`}
                              className="text-xs text-accent hover:text-accent2"
                            >
                              Download report card ↓
                            </a>
                          </td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-ink">
                              {final.letter}
                            </span>
                            <span className="ml-1.5 text-xs text-white/50">{final.points} pts</span>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Change password</h2>
        <p className="mt-1 text-sm text-white/50">
          Your account started with your child's admission number as the password. Change it any time.
        </p>
        <form action={changePasswordAction} className="mt-4 space-y-3">
          <input
            name="currentPassword"
            type="password"
            placeholder="Current password"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New password"
            required
            minLength={8}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            required
            minLength={8}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
