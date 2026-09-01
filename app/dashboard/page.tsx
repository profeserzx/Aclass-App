import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, fees, subjects, schools, attendance, disciplineCases } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import StudentsByGradeChart, { type GradeCount } from "@/app/dashboard/StudentsByGradeChart";
import {
  updateSchoolDomainAction,
  updateSchoolTaglineAction,
  updateMpesaSettingsAction,
} from "@/app/actions/school";
import { hasGrowthAccess } from "@/lib/plans";
import UpgradeRequired from "@/app/dashboard/UpgradeRequired";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function DeanOverview({ schoolId }: { schoolId: string }) {
  const today = todayIso();

  const [[{ value: studentCount }], absenteeRows, [{ value: openCases }], recentCases] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId)),
    db
      .select({ studentFirst: students.firstName, studentLast: students.lastName })
      .from(attendance)
      .innerJoin(students, eq(attendance.studentId, students.id))
      .where(and(eq(students.schoolId, schoolId), eq(attendance.date, today), eq(attendance.status, "absent"))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(disciplineCases)
      .where(and(eq(disciplineCases.schoolId, schoolId), eq(disciplineCases.status, "open"))),
    db
      .select({
        id: disciplineCases.id,
        offense: disciplineCases.offense,
        incidentDate: disciplineCases.incidentDate,
        status: disciplineCases.status,
        studentFirst: students.firstName,
        studentLast: students.lastName,
      })
      .from(disciplineCases)
      .innerJoin(students, eq(disciplineCases.studentId, students.id))
      .where(eq(disciplineCases.schoolId, schoolId))
      .orderBy(desc(disciplineCases.incidentDate))
      .limit(5),
  ]);

  const stats = [
    { label: "Students", value: studentCount, href: "/dashboard/students" },
    { label: "Today's absentees", value: absenteeRows.length, href: "/dashboard/attendance" },
    { label: "Open discipline cases", value: openCases, href: "/dashboard/discipline" },
  ];

  const quickActions = [
    { label: "Record incident", href: "/dashboard/discipline" },
    { label: "Search student", href: "/dashboard/students" },
    { label: "Attendance", href: "/dashboard/attendance" },
    { label: "Grades", href: "/dashboard/grades" },
    { label: "Contact parent", href: "/dashboard/email" },
    { label: "Leave", href: "/dashboard/leave" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dean dashboard</h1>
        <p className="mt-1 text-sm text-white/50">Students, attendance, and discipline at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20"
          >
            <div className="text-sm text-white/50">{s.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent discipline cases</h2>
          <Link href="/dashboard/discipline" className="text-sm text-accent hover:text-accent2">
            View all →
          </Link>
        </div>
        {recentCases.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No discipline cases logged yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentCases.map((c) => (
              <li key={c.id} className="flex items-center justify-between border-b border-white/5 pb-3 text-sm last:border-0">
                <span>
                  {c.offense} — {c.studentFirst} {c.studentLast}
                </span>
                <span className="text-white/40">{c.incidentDate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const schoolId = session.schoolId;

  if (session.role === "dean") {
    return <DeanOverview schoolId={schoolId} />;
  }

  const [
    [{ value: studentCount }],
    [{ value: classCount }],
    [{ value: subjectCount }],
    [{ value: pendingFees }],
    recentStudents,
    classRows,
    gradeCounts,
    [school],
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId)),
    db.select({ value: sql<number>`count(*)::int` }).from(classes).where(eq(classes.schoolId, schoolId)),
    db.select({ value: sql<number>`count(*)::int` }).from(subjects).where(eq(subjects.schoolId, schoolId)),
    db
      .select({ value: sql<number>`coalesce(sum(${fees.amount}), 0)::float` })
      .from(fees)
      .where(and(eq(fees.schoolId, schoolId), ne(fees.status, "paid"))),
    db
      .select()
      .from(students)
      .where(eq(students.schoolId, schoolId))
      .orderBy(desc(students.createdAt))
      .limit(5),
    db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    db
      .select({ classId: students.classId, value: sql<number>`count(*)::int` })
      .from(students)
      .where(eq(students.schoolId, schoolId))
      .groupBy(students.classId),
    db.select().from(schools).where(eq(schools.id, schoolId)).limit(1),
  ]);

  const classNameById = new Map(classRows.map((c) => [c.id, c.name]));
  const chartData: GradeCount[] = gradeCounts
    .map((g) => ({
      grade: g.classId ? classNameById.get(g.classId) ?? "Unknown" : "Unassigned",
      students: g.value,
    }))
    .sort((a, b) => b.students - a.students);

  const stats = [
    { label: "Students", value: studentCount, href: "/dashboard/students" },
    { label: "Classes", value: classCount, href: "/dashboard/students" },
    { label: "Subjects", value: subjectCount, href: "/dashboard/subjects" },
    { label: "Outstanding fees", value: `KES ${pendingFees.toLocaleString()}`, href: "/dashboard/fees" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-white/50">Live data from your Aclass workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20"
          >
            <div className="text-sm text-white/50">{s.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</div>
          </Link>
        ))}
      </div>

      {hasGrowthAccess(school ?? { plan: "starter", currentPeriodEnd: null }) ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">Students by grade</h2>
          <p className="mt-1 text-sm text-white/50">Live count, pulled straight from your student records.</p>
          <div className="mt-4">
            <StudentsByGradeChart data={chartData} />
          </div>
        </div>
      ) : (
        <UpgradeRequired feature="The analytics dashboard" isAdmin={session.role === "admin"} />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recently added students</h2>
          <Link href="/dashboard/students" className="text-sm text-accent hover:text-accent2">
            View all →
          </Link>
        </div>
        {recentStudents.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">
            No students yet.{" "}
            <Link href="/dashboard/students" className="text-accent hover:text-accent2">
              Add your first one
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Name</th>
                  <th className="pb-2 font-normal">Admission #</th>
                  <th className="pb-2 font-normal">Guardian</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="py-2.5 text-white/60">{s.admissionNumber ?? "—"}</td>
                    <td className="py-2.5 text-white/60">{s.guardianName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {session.role === "admin" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">School domain</h2>
          <p className="mt-1 text-sm text-white/50">
            Used to generate parent login emails: a student with admission number 1834 logs in as{" "}
            <code className="text-white/70">1834@{school?.domain || "yourschool.ac.ke"}</code>, password 1834. Only
            enter the domain part below (e.g. <code className="text-white/70">dawamu.ac.ke</code>) — not the
            admission number or the @ sign. Set this once before adding students so parent accounts get created
            automatically.
          </p>
          {searchParams.error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {searchParams.error}
            </div>
          )}
          <form action={updateSchoolDomainAction} className="mt-4 flex max-w-md gap-3">
            <input
              name="domain"
              defaultValue={school?.domain ?? ""}
              placeholder="dawamu.ac.ke"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {session.role === "admin" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">School tagline</h2>
          <p className="mt-1 text-sm text-white/50">
            A short line shown under your school's name on outgoing emails to parents and staff — e.g.
            "Transforming Boys Into Leaders". Leave blank to show none.
          </p>
          <form action={updateSchoolTaglineAction} className="mt-4 flex max-w-md gap-3">
            <input
              name="tagline"
              defaultValue={school?.tagline ?? ""}
              placeholder="Your school's motto or tagline"
              maxLength={255}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {session.role === "admin" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium">M-Pesa settings</h2>
          <p className="mt-1 text-sm text-white/50">
            Your school's own Safaricom Paybill/Till and Daraja app credentials — parent M-Pesa payments go
            straight into your account, never a shared one. Get these from{" "}
            <span className="text-white/70">developer.safaricom.co.ke</span> (create an app for "Lipa Na M-Pesa
            Online"). Consumer Secret and Passkey are stored encrypted — leave them blank when re-saving other
            fields to keep the existing values.
          </p>
          <div className="mt-3 text-xs">
            {school?.mpesaConsumerKey && school?.mpesaShortcode && school?.mpesaConsumerSecret && school?.mpesaPasskey ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
                M-Pesa configured ({school.mpesaEnv === "production" ? "production" : "sandbox"})
              </span>
            ) : (
              <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 font-medium text-yellow-300">
                Not configured yet — parents can't use "Pay with M-Pesa" until this is filled in
              </span>
            )}
          </div>
          <form action={updateMpesaSettingsAction} className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2">
            <select
              name="mpesaEnv"
              defaultValue={school?.mpesaEnv ?? "sandbox"}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent sm:col-span-2"
            >
              <option value="sandbox" className="bg-ink">
                Sandbox (testing, no real money)
              </option>
              <option value="production" className="bg-ink">
                Production (real Paybill, real money)
              </option>
            </select>
            <input
              name="mpesaShortcode"
              defaultValue={school?.mpesaShortcode ?? ""}
              placeholder="Business Shortcode (e.g. 174379)"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <input
              name="mpesaConsumerKey"
              defaultValue={school?.mpesaConsumerKey ?? ""}
              placeholder="Consumer Key"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <input
              name="mpesaConsumerSecret"
              type="password"
              placeholder={school?.mpesaConsumerSecret ? "Consumer Secret (already set — leave blank to keep)" : "Consumer Secret"}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <input
              name="mpesaPasskey"
              type="password"
              placeholder={school?.mpesaPasskey ? "Passkey (already set — leave blank to keep)" : "Passkey"}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent2 sm:col-span-2"
            >
              Save M-Pesa settings
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
