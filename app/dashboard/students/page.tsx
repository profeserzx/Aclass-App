import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { addStudentAction, deleteStudentAction } from "@/app/actions/students";
import { assignStudentClassAction } from "@/app/actions/classes";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; classId?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "admin";
  const schoolId = session.schoolId;
  const q = searchParams.q?.trim() || "";
  const classFilter = searchParams.classId?.trim() || "";

  const conditions = [eq(students.schoolId, schoolId)];
  if (q) {
    conditions.push(
      or(
        ilike(students.firstName, `%${q}%`),
        ilike(students.lastName, `%${q}%`),
        ilike(students.admissionNumber, `%${q}%`)
      )!
    );
  }
  if (classFilter) {
    conditions.push(eq(students.classId, classFilter));
  }

  const [studentRows, classRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(and(...conditions))
      .orderBy(desc(students.createdAt)),
    db.select().from(classes).where(eq(classes.schoolId, schoolId)).orderBy(classes.name),
  ]);

  const classNameById = new Map(classRows.map((c) => [c.id, c.name]));

  // Admin/dean can place any student into any class; a teacher can only
  // assign into classes where they're the class's own teacher.
  const canAssignClass = session.role === "admin" || session.role === "dean" || session.role === "teacher";
  const assignableClasses =
    session.role === "teacher" ? classRows.filter((c) => c.teacherId === session.userId) : classRows;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-white/50">{studentRows.length} student(s)</p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/students/import"
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

      <form className="flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or admission number"
          className="w-64 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
        />
        <select
          name="classId"
          defaultValue={classFilter}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
        >
          <option value="" className="bg-ink">
            All grades
          </option>
          {classRows.map((c) => (
            <option key={c.id} value={c.id} className="bg-ink">
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Filter
        </button>
        {(q || classFilter) && (
          <Link
            href="/dashboard/students"
            className="rounded-xl px-4 py-2.5 text-sm text-white/50 hover:text-white"
          >
            Clear
          </Link>
        )}
      </form>

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {studentRows.length === 0 ? (
            <p className="text-sm text-white/40">No students match yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Admission #</th>
                    <th className="pb-2 font-normal">Name</th>
                    <th className="pb-2 font-normal">Grade</th>
                    <th className="pb-2 font-normal">Guardian</th>
                    {isAdmin && <th className="pb-2 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 text-white/60">{s.admissionNumber ?? "—"}</td>
                      <td className="py-2.5">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-2.5 text-white/60">
                        {canAssignClass ? (
                          <form action={assignStudentClassAction} className="flex items-center gap-2">
                            <input type="hidden" name="studentId" value={s.id} />
                            <select
                              name="classId"
                              defaultValue={s.classId ?? ""}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-accent"
                            >
                              <option value="" className="bg-ink">
                                No class
                              </option>
                              {assignableClasses.map((c) => (
                                <option key={c.id} value={c.id} className="bg-ink">
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="text-xs text-accent hover:text-accent2">
                              Save
                            </button>
                          </form>
                        ) : s.classId ? (
                          classNameById.get(s.classId) ?? "—"
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 text-white/60">{s.guardianName ?? "—"}</td>
                      {isAdmin && (
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/dashboard/students/${s.id}/edit`}
                              className="text-accent hover:text-accent2"
                            >
                              Edit
                            </Link>
                            <form action={deleteStudentAction}>
                              <input type="hidden" name="studentId" value={s.id} />
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
            <h2 className="text-lg font-medium">Add a student</h2>
            <form action={addStudentAction} className="mt-4 space-y-3">
              <input
                name="admissionNumber"
                placeholder="Admission number"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="firstName"
                  placeholder="First name"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
                />
                <input
                  name="lastName"
                  placeholder="Last name"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
                />
              </div>
              <label className="block">
                <span className="text-xs text-white/40">Date of birth</span>
                <input
                  name="dateOfBirth"
                  type="date"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
                />
              </label>
              <select
                name="classId"
                defaultValue=""
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" className="bg-ink">
                  No class yet
                </option>
                {classRows.map((c) => (
                  <option key={c.id} value={c.id} className="bg-ink">
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                name="guardianName"
                placeholder="Parent / guardian name"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="guardianContact"
                placeholder="Parent phone"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="guardianEmail"
                type="email"
                placeholder="Parent email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
              >
                Add student
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
