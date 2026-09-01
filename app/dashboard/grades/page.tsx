import { Fragment } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { grades, students, subjects, studentSubjects } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { enterGradesAction, deleteGradeAction } from "@/app/actions/grades";
import { setStudentSubjectsAction } from "@/app/actions/studentSubjects";
import { kcseGrade, meanGrade } from "@/lib/grading";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: { studentId?: string; entryStudentId?: string; entryTerm?: string; error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  // Admin is view-only for grades — entry is done by teachers and the dean.
  const canRecord = session.role === "teacher" || session.role === "dean";
  const filterStudentId = searchParams.studentId || "";
  const entryStudentId = searchParams.entryStudentId || "";
  const entryTerm = searchParams.entryTerm || "";

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

  const allSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.schoolId, session.schoolId))
    .orderBy(subjects.name);

  const conditions = [eq(students.schoolId, session.schoolId)];
  if (filterStudentId) conditions.push(eq(grades.studentId, filterStudentId));

  const gradeRows = await db
    .select({
      id: grades.id,
      studentId: grades.studentId,
      subject: grades.subject,
      term: grades.term,
      score: grades.score,
      maxScore: grades.maxScore,
      studentFirst: students.firstName,
      studentLast: students.lastName,
    })
    .from(grades)
    .innerJoin(students, eq(grades.studentId, students.id))
    .where(and(...conditions))
    .orderBy(desc(grades.createdAt));

  // Group each student's subject scores by term so we can show a final
  // (mean) grade under each group, not just per-subject grades.
  const gradeGroups = new Map<
    string,
    { studentFirst: string; studentLast: string; term: string; rows: typeof gradeRows }
  >();
  for (const g of gradeRows) {
    const key = `${g.studentId}|${g.term}`;
    if (!gradeGroups.has(key)) {
      gradeGroups.set(key, { studentFirst: g.studentFirst, studentLast: g.studentLast, term: g.term, rows: [] });
    }
    gradeGroups.get(key)!.rows.push(g);
  }

  let entryExisting = new Map<string, { score: string; maxScore: string }>();
  if (entryStudentId && entryTerm) {
    const rows = await db
      .select()
      .from(grades)
      .where(and(eq(grades.studentId, entryStudentId), eq(grades.term, entryTerm)));
    entryExisting = new Map(rows.map((r) => [r.subject, { score: r.score, maxScore: r.maxScore }]));
  }

  // A student typically only takes 7-8 of the school's full subject list —
  // this narrows the grade-entry grid to just their assigned subjects.
  // Falls back to every subject if none have been assigned yet.
  let assignedSubjectIds = new Set<string>();
  if (entryStudentId) {
    const rows = await db
      .select({ subjectId: studentSubjects.subjectId })
      .from(studentSubjects)
      .where(eq(studentSubjects.studentId, entryStudentId));
    assignedSubjectIds = new Set(rows.map((r) => r.subjectId));
  }
  const subjectsForGrid =
    assignedSubjectIds.size > 0 ? allSubjects.filter((s) => assignedSubjectIds.has(s.id)) : allSubjects;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grades</h1>
        <p className="mt-1 text-sm text-white/50">
          {canRecord ? "Enter exam results by student and term, across every subject at once." : "View exam results."}
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-white/50">Filter by student</label>
            <select
              name="studentId"
              defaultValue={filterStudentId}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="" className="bg-ink">
                All students
              </option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id} className="bg-ink">
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Filter
          </button>
        </form>

        {gradeRows.length === 0 ? (
          <p className="text-sm text-white/40">No grades recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Student</th>
                  <th className="pb-2 font-normal">Subject</th>
                  <th className="pb-2 font-normal">Term</th>
                  <th className="pb-2 font-normal">Score</th>
                  <th className="pb-2 font-normal">Grade</th>
                  {session.role === "admin" && <th className="pb-2 font-normal"></th>}
                </tr>
              </thead>
              <tbody>
                {Array.from(gradeGroups.entries()).map(([key, group]) => {
                  const points = group.rows.map(
                    (g) => kcseGrade((Number(g.score) / Number(g.maxScore)) * 100).points
                  );
                  const final = meanGrade(points);
                  return (
                    <Fragment key={key}>
                      {group.rows.map((g) => {
                        const pct = (Number(g.score) / Number(g.maxScore)) * 100;
                        const { letter, points: subjectPoints } = kcseGrade(pct);
                        return (
                          <tr key={g.id} className="border-b border-white/5">
                            <td className="py-2.5">
                              {g.studentFirst} {g.studentLast}
                            </td>
                            <td className="py-2.5 text-white/60">{g.subject}</td>
                            <td className="py-2.5 text-white/60">{g.term}</td>
                            <td className="py-2.5">
                              {g.score}/{g.maxScore}{" "}
                              <span className="text-xs text-white/40">({Math.round(pct)}%)</span>
                            </td>
                            <td className="py-2.5">
                              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent2">
                                {letter}
                              </span>
                              <span className="ml-1.5 text-xs text-white/40">{subjectPoints} pts</span>
                            </td>
                            {session.role === "admin" && (
                              <td className="py-2.5 text-right">
                                <form action={deleteGradeAction}>
                                  <input type="hidden" name="gradeId" value={g.id} />
                                  <button type="submit" className="text-white/40 hover:text-red-400">
                                    Delete
                                  </button>
                                </form>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {final && (
                        <tr className="border-b border-white/10 bg-white/[0.04] last:border-0">
                          <td className="py-2.5 font-medium" colSpan={3}>
                            Final grade — {group.studentFirst} {group.studentLast} ({group.term})
                          </td>
                          <td className="py-2.5">
                            <a
                              href={`/api/report-card?studentId=${group.rows[0].studentId}&term=${encodeURIComponent(group.term)}`}
                              className="text-xs text-accent hover:text-accent2"
                            >
                              Download ↓
                            </a>
                          </td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-ink">
                              {final.letter}
                            </span>
                            <span className="ml-1.5 text-xs text-white/50">{final.points} pts</span>
                          </td>
                          {session.role === "admin" && <td className="py-2.5"></td>}
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

      {canRecord && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">Enter grades</h2>
          <p className="mt-1 text-sm text-white/50">
            Pick a student and a term, then fill in as many subjects as you have marks for — all in one save.
          </p>
          <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Student</label>
              <select
                name="entryStudentId"
                defaultValue={entryStudentId}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="" className="bg-ink">
                  Select student
                </option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink">
                    {s.firstName} {s.lastName}
                    {s.admissionNumber ? ` (${s.admissionNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/50">Term</label>
              <input
                name="entryTerm"
                defaultValue={entryTerm}
                placeholder="e.g. Term 1 2026"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Load
            </button>
          </form>

          {entryStudentId && allSubjects.length > 0 && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-medium">Subjects this student takes</h3>
              <p className="mt-1 text-xs text-white/40">
                Pick the subject combination for this student — the grade grid below will only show these.
              </p>
              <form action={setStudentSubjectsAction} className="mt-3">
                <input type="hidden" name="studentId" value={entryStudentId} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {allSubjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        name="subjectIds"
                        value={sub.id}
                        defaultChecked={assignedSubjectIds.has(sub.id)}
                      />
                      {sub.name}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Save subjects
                </button>
              </form>
            </div>
          )}

          {entryStudentId && entryTerm && (
            subjectsForGrid.length === 0 ? (
              <p className="mt-4 text-sm text-white/40">
                No subjects set up yet — add some on the Subjects page first.
              </p>
            ) : (
              <form action={enterGradesAction} className="mt-5">
                <input type="hidden" name="studentId" value={entryStudentId} />
                <input type="hidden" name="term" value={entryTerm} />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40">
                        <th className="pb-2 font-normal">Subject</th>
                        <th className="pb-2 font-normal">Score</th>
                        <th className="pb-2 font-normal">Max score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectsForGrid.map((sub) => {
                        const existing = entryExisting.get(sub.name);
                        return (
                          <tr key={sub.id} className="border-b border-white/5 last:border-0">
                            <td className="py-2 pr-4">{sub.name}</td>
                            <td className="py-2 pr-4">
                              <input
                                name={`score_${sub.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={existing?.score ?? ""}
                                placeholder="—"
                                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                name={`max_${sub.id}`}
                                type="number"
                                step="0.01"
                                min="1"
                                defaultValue={existing?.maxScore ?? "100"}
                                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="submit"
                  className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
                >
                  Save all grades
                </button>
                <p className="mt-2 text-xs text-white/30">
                  Leave a subject's score blank to skip it. Re-saving updates existing entries instead of duplicating them.
                </p>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}
