import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { addSubjectAction, deleteSubjectAction } from "@/app/actions/subjects";

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "admin";

  const subjectRows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.schoolId, session.schoolId))
    .orderBy(asc(subjects.name));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
          <p className="mt-1 text-sm text-white/50">{subjectRows.length} subject(s)</p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/subjects/import"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Import from CSV
          </Link>
        )}
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {subjectRows.length === 0 ? (
            <p className="text-sm text-white/40">No subjects yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Name</th>
                    <th className="pb-2 font-normal">Code</th>
                    {isAdmin && <th className="pb-2 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">{s.name}</td>
                      <td className="py-2.5 text-white/60">{s.code}</td>
                      {isAdmin && (
                        <td className="py-2.5 text-right">
                          <form action={deleteSubjectAction}>
                            <input type="hidden" name="subjectId" value={s.id} />
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

        {isAdmin && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-medium">Add a subject</h2>
            <form action={addSubjectAction} className="mt-4 space-y-3">
              <input
                name="name"
                placeholder="Subject name (e.g. Mathematics)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="code"
                placeholder="Code (e.g. MATH)"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
              >
                Add subject
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
