import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { leaveRequests, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { requestLeaveAction, reviewLeaveAction, cancelLeaveAction } from "@/app/actions/leave";

const TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  study: "Study",
  compassionate: "Compassionate",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
};

export default async function LeavePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const canReview = session.role === "admin" || session.role === "dean";

  const requester = alias(users, "requester");
  const reviewer = alias(users, "reviewer");

  const requests = await db
    .select({
      id: leaveRequests.id,
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      userId: leaveRequests.userId,
      requesterName: requester.name,
      reviewerName: reviewer.name,
    })
    .from(leaveRequests)
    .leftJoin(requester, eq(leaveRequests.userId, requester.id))
    .leftJoin(reviewer, eq(leaveRequests.reviewedBy, reviewer.id))
    .where(eq(leaveRequests.schoolId, session.schoolId))
    .orderBy(desc(leaveRequests.startDate));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
        <p className="mt-1 text-sm text-white/50">
          {canReview ? "Review staff leave requests." : "Request leave and track its status."}
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {requests.length === 0 ? (
            <p className="text-sm text-white/40">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Staff</th>
                    <th className="pb-2 font-normal">Type</th>
                    <th className="pb-2 font-normal">Dates</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0 align-top">
                      <td className="py-2.5">{r.requesterName ?? "—"}</td>
                      <td className="py-2.5 text-white/60">{TYPE_LABELS[r.leaveType] ?? r.leaveType}</td>
                      <td className="py-2.5 text-white/60">
                        {r.startDate} → {r.endDate}
                        {r.reason && <div className="mt-1 text-xs text-white/40">{r.reason}</div>}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            STATUS_STYLES[r.status] ?? ""
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.reviewerName && r.status !== "pending" && (
                          <div className="mt-1 text-xs text-white/40">by {r.reviewerName}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {r.status === "pending" && canReview && (
                          <div className="flex justify-end gap-3">
                            <form action={reviewLeaveAction}>
                              <input type="hidden" name="requestId" value={r.id} />
                              <input type="hidden" name="decision" value="approved" />
                              <button type="submit" className="text-emerald-400 hover:text-emerald-300">
                                Approve
                              </button>
                            </form>
                            <form action={reviewLeaveAction}>
                              <input type="hidden" name="requestId" value={r.id} />
                              <input type="hidden" name="decision" value="rejected" />
                              <button type="submit" className="text-red-400 hover:text-red-300">
                                Reject
                              </button>
                            </form>
                          </div>
                        )}
                        {r.status === "pending" && !canReview && r.userId === session.userId && (
                          <form action={cancelLeaveAction}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <button type="submit" className="text-white/50 hover:text-white">
                              Cancel
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">Request leave</h2>
          <form action={requestLeaveAction} className="mt-4 space-y-3">
            <select
              name="leaveType"
              defaultValue="annual"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="annual" className="bg-ink">
                Annual
              </option>
              <option value="sick" className="bg-ink">
                Sick
              </option>
              <option value="study" className="bg-ink">
                Study
              </option>
              <option value="compassionate" className="bg-ink">
                Compassionate
              </option>
              <option value="other" className="bg-ink">
                Other
              </option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Start date</label>
                <input
                  name="startDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">End date</label>
                <input
                  name="endDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>
            </div>
            <textarea
              name="reason"
              placeholder="Reason (optional)"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Submit request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
