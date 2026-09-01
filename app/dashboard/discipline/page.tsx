import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { disciplineCases, students, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  createDisciplineCaseAction,
  setDisciplineCaseStatusAction,
  deleteDisciplineCaseAction,
} from "@/app/actions/discipline";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-300",
  closed: "bg-emerald-500/15 text-emerald-300",
};

export default async function DisciplinePage({
  searchParams,
}: {
  searchParams: { status?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const canManage = session.role === "admin" || session.role === "dean";
  const statusFilter = searchParams.status === "open" || searchParams.status === "closed" ? searchParams.status : "";

  const allStudents = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    })
    .from(students)
    .where(eq(students.schoolId, session.schoolId))
    .orderBy(students.firstName);

  const conditions = [eq(students.schoolId, session.schoolId)];
  if (statusFilter) conditions.push(eq(disciplineCases.status, statusFilter));

  const cases = await db
    .select({
      id: disciplineCases.id,
      incidentDate: disciplineCases.incidentDate,
      offense: disciplineCases.offense,
      description: disciplineCases.description,
      actionTaken: disciplineCases.actionTaken,
      status: disciplineCases.status,
      studentFirst: students.firstName,
      studentLast: students.lastName,
      admissionNumber: students.admissionNumber,
      reporterName: users.name,
    })
    .from(disciplineCases)
    .innerJoin(students, eq(disciplineCases.studentId, students.id))
    .leftJoin(users, eq(disciplineCases.reportedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(disciplineCases.incidentDate));

  const openCount = cases.filter((c) => c.status === "open").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discipline</h1>
        <p className="mt-1 text-sm text-white/50">
          {canManage ? "Log and track student discipline cases." : "View student discipline cases."}
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Status</label>
              <select
                name="status"
                defaultValue={statusFilter}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" className="bg-ink">
                  All ({cases.length})
                </option>
                <option value="open" className="bg-ink">
                  Open
                </option>
                <option value="closed" className="bg-ink">
                  Closed
                </option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Filter
            </button>
            <span className="ml-auto text-sm text-white/40">{openCount} open case(s)</span>
          </form>

          {cases.length === 0 ? (
            <p className="text-sm text-white/40">No discipline cases recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Student</th>
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">Offense</th>
                    <th className="pb-2 font-normal">Status</th>
                    {canManage && <th className="pb-2 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0 align-top">
                      <td className="py-2.5">
                        {c.studentFirst} {c.studentLast}
                        {c.admissionNumber && (
                          <div className="text-xs text-white/40">#{c.admissionNumber}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-white/60">{c.incidentDate}</td>
                      <td className="py-2.5 text-white/60">
                        {c.offense}
                        {c.description && <div className="mt-1 text-xs text-white/40">{c.description}</div>}
                        {c.actionTaken && (
                          <div className="mt-1 text-xs text-white/40">Action: {c.actionTaken}</div>
                        )}
                        {c.reporterName && (
                          <div className="mt-1 text-xs text-white/30">Reported by {c.reporterName}</div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            STATUS_STYLES[c.status] ?? ""
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-3">
                            <form action={setDisciplineCaseStatusAction}>
                              <input type="hidden" name="caseId" value={c.id} />
                              <input type="hidden" name="status" value={c.status === "open" ? "closed" : "open"} />
                              <button type="submit" className="text-accent hover:text-accent2">
                                {c.status === "open" ? "Close" : "Reopen"}
                              </button>
                            </form>
                            {session.role === "admin" && (
                              <form action={deleteDisciplineCaseAction}>
                                <input type="hidden" name="caseId" value={c.id} />
                                <button type="submit" className="text-white/40 hover:text-red-400">
                                  Delete
                                </button>
                              </form>
                            )}
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

        {canManage && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-medium">Log a case</h2>
            <form action={createDisciplineCaseAction} className="mt-4 space-y-3">
              <select
                name="studentId"
                required
                defaultValue=""
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" disabled className="bg-ink">
                  Select student
                </option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink">
                    {s.firstName} {s.lastName}
                    {s.admissionNumber ? ` (${s.admissionNumber})` : ""}
                  </option>
                ))}
              </select>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">Incident date</label>
                <input
                  name="incidentDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>
              <input
                name="offense"
                placeholder="Offense (e.g. Fighting)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <textarea
                name="description"
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="actionTaken"
                placeholder="Action taken (e.g. Warning, Suspension)"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
              >
                Save case
              </button>
              <p className="text-xs text-white/30">
                To notify a parent about this, use the Email page and pick their child specifically.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
