"use server";

import { redirect } from "next/navigation";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { students, smsLogs, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { sendSms } from "@/lib/sms";
import { normalizeKenyanPhone } from "@/lib/mpesa";
import { hasGrowthAccess } from "@/lib/plans";

const MAX_MESSAGE_LENGTH = 459; // 3 concatenated SMS segments (153 chars each)

type Recipient = { phone: string; name: string | null };

export async function sendSmsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  // Re-check Growth access server-side even though the page already hides
  // this form for Starter schools — same defense-in-depth principle used
  // everywhere else access is gated in this app.
  const [school] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);
  if (!school || !hasGrowthAccess(school)) {
    redirect(
      `/dashboard/sms?error=${encodeURIComponent(
        "SMS alerts are a Growth-plan feature. Upgrade on the Billing page to use this."
      )}`
    );
  }

  const message = String(formData.get("message") || "").trim();
  const target = String(formData.get("target") || "").trim();
  const selectedStudentIds = formData.getAll("studentIds").map(String);

  if (!message) {
    redirect(`/dashboard/sms?error=${encodeURIComponent("Write a message first.")}`);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    redirect(
      `/dashboard/sms?error=${encodeURIComponent(
        `Message is too long — keep it under ${MAX_MESSAGE_LENGTH} characters (3 SMS segments).`
      )}`
    );
  }

  const conditions = [eq(students.schoolId, session.schoolId), isNotNull(students.guardianContact)];
  if (target === "specific_parents") {
    if (selectedStudentIds.length === 0) {
      redirect(`/dashboard/sms?error=${encodeURIComponent("Select at least one student.")}`);
    }
    conditions.push(inArray(students.id, selectedStudentIds));
  } else if (target !== "all_parents") {
    redirect(`/dashboard/sms?error=${encodeURIComponent("Choose who to send this to.")}`);
  }

  const rows = await db
    .select({
      phone: students.guardianContact,
      name: students.guardianName,
      studentFirst: students.firstName,
    })
    .from(students)
    .where(and(...conditions));

  let recipients: Recipient[] = [];
  for (const r of rows) {
    if (!r.phone) continue;
    const normalized = normalizeKenyanPhone(r.phone);
    if (!normalized) continue;
    recipients.push({ phone: normalized, name: r.name ?? `Parent of ${r.studentFirst}` });
  }

  // De-duplicate — the same guardian phone could be on file for more than
  // one student (siblings), and we don't want to text them twice.
  const seen = new Set<string>();
  recipients = recipients.filter((r) => {
    if (seen.has(r.phone)) return false;
    seen.add(r.phone);
    return true;
  });

  if (recipients.length === 0) {
    redirect(
      `/dashboard/sms?error=${encodeURIComponent("No recipients with a valid phone number on file were found.")}`
    );
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendSms({ to: recipient.phone, message });
      await db.insert(smsLogs).values({
        schoolId: session.schoolId,
        sentBy: session.userId,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        message,
        status: "sent",
        cost: result.cost,
      });
      sent++;
    } catch (err) {
      await db.insert(smsLogs).values({
        schoolId: session.schoolId,
        sentBy: session.userId,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        message,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      failed++;
    }
  }

  redirect(
    `/dashboard/sms?success=${encodeURIComponent(
      `Sent ${sent} SMS.${failed > 0 ? ` ${failed} failed — check the log below.` : ""}`
    )}`
  );
}
