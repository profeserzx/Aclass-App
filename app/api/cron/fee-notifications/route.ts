import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, students, schools, emailLogs } from "@/db/schema";
import { sendEmail, buildEmailHtml } from "@/lib/email";

// Daily cron — called by the `cron` compose service at 8 AM.
// 1. Sends "due in 3 days" reminder emails for fees not yet reminded.
// 2. Marks past-due fees as "overdue" and sends overdue notification emails.

export async function GET(request: NextRequest) {
  const token = process.env.CRON_SECRET;
  if (token) {
    const provided = request.nextUrl.searchParams.get("token");
    if (provided !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let remindersSent = 0;
  let overdueSent = 0;

  // 1. Due-in-3-days reminders
  const dueSoon = await db
    .select({ fee: fees, student: students, school: schools })
    .from(fees)
    .innerJoin(students, eq(fees.studentId, students.id))
    .innerJoin(schools, eq(fees.schoolId, schools.id))
    .where(
      and(
        sql`${fees.dueDate} = ${threeDaysFromNow}`,
        sql`${fees.status} != 'paid'`,
        sql`${fees.reminderSentAt} IS NULL`,
        isNotNull(students.guardianEmail)
      )
    );

  for (const row of dueSoon) {
    const { fee, student, school } = row;
    const studentName = `${student.firstName} ${student.lastName}`;
    const subject = `Fee reminder: ${fee.description} due in 3 days — KES ${Number(fee.amount).toLocaleString()}`;
    const bodyText = `Dear Parent of ${studentName},

This is a reminder that the following fee is due in 3 days:

Fee: ${fee.description}${fee.term ? `\nTerm: ${fee.term}` : ""}
Amount: KES ${Number(fee.amount).toLocaleString()}
Due date: ${fee.dueDate}

Please make payment before the due date. You can pay through the parent portal using M-Pesa or other methods.

Log in to the parent portal to view details and make a payment.`;

    try {
      await sendEmail({
        to: student.guardianEmail!,
        subject,
        text: bodyText,
        html: buildEmailHtml({ schoolName: school.name, schoolTagline: school.tagline, studentName, bodyText }),
        fromName: school.name,
      });
      await db.insert(emailLogs).values({
        schoolId: fee.schoolId,
        recipientEmail: student.guardianEmail!,
        recipientName: student.guardianName ?? `Parent of ${studentName}`,
        subject,
        body: bodyText,
        status: "sent",
      });
      await db.update(fees).set({ reminderSentAt: new Date() }).where(eq(fees.id, fee.id));
      remindersSent++;
    } catch (err) {
      await db.insert(emailLogs).values({
        schoolId: fee.schoolId,
        recipientEmail: student.guardianEmail!,
        recipientName: student.guardianName ?? `Parent of ${studentName}`,
        subject,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // 2. Overdue notifications + status update
  const overdue = await db
    .select({ fee: fees, student: students, school: schools })
    .from(fees)
    .innerJoin(students, eq(fees.studentId, students.id))
    .innerJoin(schools, eq(fees.schoolId, schools.id))
    .where(
      and(
        sql`${fees.dueDate} < ${today}`,
        eq(fees.status, "pending"),
        sql`${fees.overdueNotifiedAt} IS NULL`,
        isNotNull(students.guardianEmail)
      )
    );

  for (const row of overdue) {
    const { fee, student, school } = row;
    const studentName = `${student.firstName} ${student.lastName}`;
    const subject = `OVERDUE: ${fee.description} — KES ${Number(fee.amount).toLocaleString()}`;
    const bodyText = `Dear Parent of ${studentName},

The following fee is now OVERDUE:

Fee: ${fee.description}${fee.term ? `\nTerm: ${fee.term}` : ""}
Amount: KES ${Number(fee.amount).toLocaleString()}
Due date: ${fee.dueDate}

Please make payment as soon as possible. You can pay through the parent portal using M-Pesa or other methods.

Log in to the parent portal to view details and make a payment.`;

    try {
      await sendEmail({
        to: student.guardianEmail!,
        subject,
        text: bodyText,
        html: buildEmailHtml({ schoolName: school.name, schoolTagline: school.tagline, studentName, bodyText }),
        fromName: school.name,
      });
      await db.insert(emailLogs).values({
        schoolId: fee.schoolId,
        recipientEmail: student.guardianEmail!,
        recipientName: student.guardianName ?? `Parent of ${studentName}`,
        subject,
        body: bodyText,
        status: "sent",
      });
    } catch (err) {
      await db.insert(emailLogs).values({
        schoolId: fee.schoolId,
        recipientEmail: student.guardianEmail!,
        recipientName: student.guardianName ?? `Parent of ${studentName}`,
        subject,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
    await db
      .update(fees)
      .set({ status: "overdue", overdueNotifiedAt: new Date() })
      .where(eq(fees.id, fee.id));
    overdueSent++;
  }

  return NextResponse.json({ date: today, remindersSent, overdueSent });
}
