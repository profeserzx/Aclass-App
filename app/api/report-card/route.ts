import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, grades, attendance, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { buildReportCardPdf } from "@/lib/reportCard";

// pdfkit needs Node's fs/Buffer (it loads its bundled standard fonts from
// disk) — must run on the Node runtime, not the Edge runtime.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const studentId = req.nextUrl.searchParams.get("studentId") || "";
  const term = req.nextUrl.searchParams.get("term") || "";
  if (!studentId || !term) {
    return NextResponse.json({ error: "Missing studentId or term." }, { status: 400 });
  }

  const [student] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  // Parents can only pull their own child's report card; staff can pull any
  // student's within their own school — same tenant scoping used everywhere
  // else in the app.
  if (session.role === "parent") {
    if (student.userId !== session.userId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
  } else if (student.schoolId !== session.schoolId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const [[school], studentClass, gradeRows, attendanceRows] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, student.schoolId)).limit(1),
    student.classId ? db.select().from(classes).where(eq(classes.id, student.classId)).limit(1) : Promise.resolve([]),
    db.select().from(grades).where(and(eq(grades.studentId, studentId), eq(grades.term, term))),
    db.select().from(attendance).where(eq(attendance.studentId, studentId)),
  ]);

  const attendanceRate =
    attendanceRows.length > 0
      ? Math.round(
          (attendanceRows.filter((a) => a.status === "present" || a.status === "late").length / attendanceRows.length) * 100
        )
      : null;

  const pdfBuffer = await buildReportCardPdf({
    schoolName: school?.name ?? "Aclass School",
    schoolTagline: school?.tagline ?? null,
    studentName: `${student.firstName} ${student.lastName}`,
    admissionNumber: student.admissionNumber,
    className: studentClass[0]?.name ?? null,
    guardianName: student.guardianName,
    term,
    rows: gradeRows.map((g) => ({ subject: g.subject, score: Number(g.score), maxScore: Number(g.maxScore) })),
    attendanceRate,
  });

  const fileName = `${student.firstName}-${student.lastName}-${term}-report-card.pdf`.replace(/\s+/g, "-");

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
