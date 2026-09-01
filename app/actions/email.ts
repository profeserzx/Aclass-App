"use server";

import { redirect } from "next/navigation";
import { eq, inArray, isNotNull, and, or } from "drizzle-orm";
import { db } from "@/db";
import { students, users, emailLogs, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { sendEmail, buildEmailHtml } from "@/lib/email";

const STAFF_ROLES = ["admin", "teacher", "dean", "deputy_principal"] as const;

type Recipient = { email: string; name: string | null; studentName?: string | null };

export async function sendEmailAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const target = String(formData.get("target") || "").trim();
  const selectedStudentIds = formData.getAll("studentIds").map(String);
  const selectedStaffIds = formData.getAll("staffIds").map(String);

  if (!subject || !message) {
    redirect(`/dashboard/email?error=${encodeURIComponent("Subject and message are required.")}`);
  }

  const [school] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);
  const schoolName = school?.name ?? "Aclass";
  const schoolTagline = school?.tagline ?? null;

  let recipients: Recipient[] = [];

  if (target === "all_parents" || target === "specific_parents") {
    const conditions = [eq(students.schoolId, session.schoolId), isNotNull(students.guardianEmail)];
    if (target === "specific_parents") {
      if (selectedStudentIds.length === 0) {
        redirect(`/dashboard/email?error=${encodeURIComponent("Select at least one student.")}`);
      }
      conditions.push(inArray(students.id, selectedStudentIds));
    }
    const rows = await db
      .select({
        email: students.guardianEmail,
        name: students.guardianName,
        studentFirst: students.firstName,
        studentLast: students.lastName,
      })
      .from(students)
      .where(and(...conditions));
    recipients = rows
      .filter((r) => r.email)
      .map((r) => ({
        email: r.email as string,
        name: r.name ?? `Parent of ${r.studentFirst}`,
        studentName: `${r.studentFirst} ${r.studentLast}`,
      }));
  } else if (target === "all_staff" || target === "specific_staff") {
    const staffRoleFilter = or(...STAFF_ROLES.map((r) => eq(users.role, r)))!;
    const conditions = [eq(users.schoolId, session.schoolId), staffRoleFilter];
    if (target === "specific_staff") {
      if (selectedStaffIds.length === 0) {
        redirect(`/dashboard/email?error=${encodeURIComponent("Select at least one staff member.")}`);
      }
      conditions.push(inArray(users.id, selectedStaffIds));
    }
    const rows = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(...conditions));
    recipients = rows.map((r) => ({ email: r.email, name: r.name }));
  } else {
    redirect(`/dashboard/email?error=${encodeURIComponent("Choose who to send this to.")}`);
  }

  // De-duplicate — the same email could be entered for multiple students, etc.
  const seen = new Set<string>();
  recipients = recipients.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  if (recipients.length === 0) {
    redirect(`/dashboard/email?error=${encodeURIComponent("No recipients with an email on file were found.")}`);
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        text: message,
        html: buildEmailHtml({
          schoolName,
          schoolTagline,
          studentName: recipient.studentName,
          bodyText: message,
        }),
        fromName: schoolName,
      });
      await db.insert(emailLogs).values({
        schoolId: session.schoolId,
        sentBy: session.userId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject,
        body: message,
        status: "sent",
      });
      sent++;
    } catch (err) {
      await db.insert(emailLogs).values({
        schoolId: session.schoolId,
        sentBy: session.userId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      failed++;
    }
  }

  redirect(
    `/dashboard/email?success=${encodeURIComponent(
      `Sent ${sent} email(s).${failed > 0 ? ` ${failed} failed — check the log below.` : ""}`
    )}`
  );
}
