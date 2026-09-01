import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { fees, students } from "@/db/schema";
import { getSession } from "@/lib/session";
import { updateFeeAction } from "@/app/actions/fees";

export default async function EditFeePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/fees");

  const [fee] = await db
    .select()
    .from(fees)
    .where(and(eq(fees.id, params.id), eq(fees.schoolId, session.schoolId)))
    .limit(1);
  if (!fee) notFound();

  const [student] = await db.select().from(students).where(eq(students.id, fee.studentId)).limit(1);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit fee — {student ? `${student.firstName} ${student.lastName}` : "Student"}
      </h1>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <form action={updateFeeAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <input type="hidden" name="feeId" value={fee.id} />
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Description</label>
          <input
            name="description"
            defaultValue={fee.description}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Term</label>
          <input
            name="term"
            defaultValue={fee.term ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Amount (KES)</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={fee.amount}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Due date</label>
            <input
              name="dueDate"
              type="date"
              defaultValue={fee.dueDate}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Status</label>
          <select
            name="status"
            defaultValue={fee.status}
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
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Save changes
          </button>
          <a href="/dashboard/fees" className="text-sm text-white/50 hover:text-white">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
