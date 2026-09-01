import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, classes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { updateStudentAction } from "@/app/actions/students";

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/students");

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, params.id), eq(students.schoolId, session.schoolId)))
    .limit(1);

  if (!student) notFound();

  const classRows = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, session.schoolId))
    .orderBy(classes.name);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit {student.firstName} {student.lastName}
      </h1>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <form action={updateStudentAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <input type="hidden" name="studentId" value={student.id} />
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Admission number</label>
          <input
            name="admissionNumber"
            defaultValue={student.admissionNumber ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-white/70">First name</label>
            <input
              name="firstName"
              defaultValue={student.firstName}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Last name</label>
            <input
              name="lastName"
              defaultValue={student.lastName}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Date of birth</label>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={student.dateOfBirth ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Grade / class</label>
          <select
            name="classId"
            defaultValue={student.classId ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          >
            <option value="" className="bg-ink">
              No class
            </option>
            {classRows.map((c) => (
              <option key={c.id} value={c.id} className="bg-ink">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Parent / guardian name</label>
          <input
            name="guardianName"
            defaultValue={student.guardianName ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Parent phone</label>
            <input
              name="guardianContact"
              defaultValue={student.guardianContact ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Parent email</label>
            <input
              name="guardianEmail"
              type="email"
              defaultValue={student.guardianEmail ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Save changes
          </button>
          <a href="/dashboard/students" className="text-sm text-white/50 hover:text-white">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
