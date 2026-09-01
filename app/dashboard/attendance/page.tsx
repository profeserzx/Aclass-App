import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendance, classes, students } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { markAttendanceAction } from "@/app/actions/attendance";

const STATUS_OPTIONS = ["present", "absent", "late", "excused"] as const;

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-300",
  absent: "bg-red-500/15 text-red-300",
  late: "bg-yellow-500/15 text-yellow-300",
  excused: "bg-blue-500/15 text-blue-300",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { classId?: string; date?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const canRecord = session.role === "admin" || session.role === "teacher";
  const date = searchParams.date || todayIso();

  const allClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, session.schoolId))
    .orderBy(classes.name);

  const selectedClassId = searchParams.classId || allClasses[0]?.id || "";

  let classStudents: { id: string; firstName: string; lastName: string; admissionNumber: string | null }[] = [];
  let existingByStudent = new Map<string, string>();

  if (selectedClassId) {
    classStudents = await db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      })
      .from(students)
      .where(and(eq(students.classId, selectedClassId), eq(students.schoolId, session.schoolId)))
      .orderBy(students.firstName);

    const records = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.classId, selectedClassId), eq(attendance.date, date)));
    existingByStudent = new Map(records.map((r) => [r.studentId, r.status]));
  }

  const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const s of classStudents) {
    const status = existingByStudent.get(s.id);
    if (status && status in counts) {
      (counts as Record<string, number>)[status]++;
    } else {
      counts.unmarked++;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm text-white/50">
          {canRecord ? "Mark daily attendance for a class." : "View attendance records."}
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      {allClasses.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-white/40">
            No classes yet. Classes are created automatically when students are imported or added with a grade/class name.
          </p>
        </div>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Class</label>
              <select
                name="classId"
                defaultValue={selectedClassId}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {allClasses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-ink">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              View
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(["present", "absent", "late", "excused", "unmarked"] as const).map((key) => (
              <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs capitalize text-white/50">{key}</div>
                <div className="mt-1 text-xl font-semibold">{counts[key]}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {classStudents.length === 0 ? (
              <p className="text-sm text-white/40">No students in this class yet.</p>
            ) : canRecord ? (
              <form action={markAttendanceAction}>
                <input type="hidden" name="classId" value={selectedClassId} />
                <input type="hidden" name="date" value={date} />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40">
                        <th className="pb-2 font-normal">Admission #</th>
                        <th className="pb-2 font-normal">Student</th>
                        <th className="pb-2 font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((s) => (
                        <tr key={s.id} className="border-b border-white/5 last:border-0">
                          <td className="py-2.5 text-white/60">{s.admissionNumber ?? "—"}</td>
                          <td className="py-2.5">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="py-2.5">
                            <select
                              name={`status_${s.id}`}
                              defaultValue={existingByStudent.get(s.id) ?? "present"}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt} className="bg-ink capitalize">
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="submit"
                  className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
                >
                  Save attendance
                </button>
              </form>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="pb-2 font-normal">Admission #</th>
                      <th className="pb-2 font-normal">Student</th>
                      <th className="pb-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((s) => {
                      const status = existingByStudent.get(s.id);
                      return (
                        <tr key={s.id} className="border-b border-white/5 last:border-0">
                          <td className="py-2.5 text-white/60">{s.admissionNumber ?? "—"}</td>
                          <td className="py-2.5">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                                status ? STATUS_STYLES[status] ?? "" : "bg-white/10 text-white/40"
                              }`}
                            >
                              {status ?? "unmarked"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
