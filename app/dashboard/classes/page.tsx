import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createClassAction, deleteClassAction } from "@/app/actions/classes";
import { CURRICULUM_GRADE_GROUPS } from "@/lib/curriculum";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [classRows, staffRows, countRows] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, session.schoolId)).orderBy(classes.name),
    db.select().from(users).where(eq(users.schoolId, session.schoolId)),
    db
      .select({ classId: students.classId, count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(eq(students.schoolId, session.schoolId), sql`${students.classId} is not null`))
      .groupBy(students.classId),
  ]);

  const teacherOptions = staffRows.filter(
    (u) => u.role !== "admin" && u.role !== "parent" && u.role !== "student"
  );
  const teacherNameById = new Map(staffRows.map((u) => [u.id, u.name]));
  const studentCountByClass = new Map(countRows.map((r) => [r.classId, r.count]));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
          <p className="mt-1 text-sm text-white/50">
            {classRows.length} class(es). Create one for each stream your school runs — Standard/Form for 8-4-4,
            Grade for CBC, or anything custom.
          </p>
        </div>
        <Link
          href="/dashboard/classes/import"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Import from CSV
        </Link>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {classRows.length === 0 ? (
            <p className="text-sm text-white/40">No classes yet — add your first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Name</th>
                    <th className="pb-2 font-normal">Grade level</th>
                    <th className="pb-2 font-normal">Class teacher</th>
                    <th className="pb-2 font-normal">Students</th>
                    <th className="pb-2 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">{c.name}</td>
                      <td className="py-2.5 text-white/60">{c.gradeLevel ?? "—"}</td>
                      <td className="py-2.5 text-white/60">
                        {c.teacherId ? teacherNameById.get(c.teacherId) ?? "—" : "—"}
                      </td>
                      <td className="py-2.5 text-white/60">{studentCountByClass.get(c.id) ?? 0}</td>
                      <td className="py-2.5 text-right">
                        <form action={deleteClassAction}>
                          <input type="hidden" name="classId" value={c.id} />
                          <button type="submit" className="text-red-400 hover:text-red-300">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">Add a class</h2>
          <form action={createClassAction} className="mt-4 space-y-3">
            <input
              name="name"
              placeholder="Class name, e.g. Grade 7 East"
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <div>
              <label className="mb-1.5 block text-xs text-white/40">Grade level</label>
              <select
                name="gradeLevel"
                defaultValue=""
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" className="bg-ink">
                  None / set custom below
                </option>
                {CURRICULUM_GRADE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label} className="bg-ink">
                    {group.levels.map((level) => (
                      <option key={level} value={level} className="bg-ink">
                        {level}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                name="gradeLevelCustom"
                placeholder="Or type a custom grade level"
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
            </div>
            <select
              name="teacherId"
              defaultValue=""
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="" className="bg-ink">
                No class teacher yet
              </option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id} className="bg-ink">
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Add class
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
