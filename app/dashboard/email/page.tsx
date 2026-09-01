import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { students, users, emailLogs } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { sendEmailAction } from "@/app/actions/email";

const STAFF_ROLES = ["admin", "teacher", "dean", "deputy_principal"] as const;
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  teacher: "Teacher",
  dean: "Dean",
  deputy_principal: "Deputy Principal",
};

export default async function EmailPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "parent") redirect("/parent");

  const [studentsWithEmail, staffRows, history] = await Promise.all([
    db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        guardianName: students.guardianName,
        guardianEmail: students.guardianEmail,
      })
      .from(students)
      .where(and(eq(students.schoolId, session.schoolId), isNotNull(students.guardianEmail))),
    db
      .select()
      .from(users)
      .where(
        and(eq(users.schoolId, session.schoolId), or(...STAFF_ROLES.map((r) => eq(users.role, r))))
      ),
    db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.schoolId, session.schoolId))
      .orderBy(desc(emailLogs.createdAt))
      .limit(50),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
        <p className="mt-1 text-sm text-white/50">
          Send an email to parents or staff. Delivered from the school's Gmail account.
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="rounded-xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
          {searchParams.success}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Compose</h2>
        <form action={sendEmailAction} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-white/70">Send to</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <input type="radio" name="target" value="all_parents" defaultChecked />
                All parents ({studentsWithEmail.length})
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <input type="radio" name="target" value="specific_parents" />
                Specific student(s)' parent
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <input type="radio" name="target" value="all_staff" />
                All staff ({staffRows.length})
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <input type="radio" name="target" value="specific_staff" />
                Specific staff member(s)
              </label>
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <summary className="cursor-pointer text-sm text-white/70">
              Choose specific students ({studentsWithEmail.length} with a parent email on file)
            </summary>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {studentsWithEmail.length === 0 ? (
                <p className="text-sm text-white/40">No students have a parent email on file yet.</p>
              ) : (
                studentsWithEmail.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" name="studentIds" value={s.id} />
                    {s.firstName} {s.lastName} — {s.guardianName ?? "Parent"} ({s.guardianEmail})
                  </label>
                ))
              )}
            </div>
          </details>

          <details className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <summary className="cursor-pointer text-sm text-white/70">
              Choose specific staff ({staffRows.length})
            </summary>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {staffRows.length === 0 ? (
                <p className="text-sm text-white/40">No staff accounts yet.</p>
              ) : (
                staffRows.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" name="staffIds" value={u.id} />
                    {u.name} — {ROLE_LABELS[u.role] ?? u.role} ({u.email})
                  </label>
                ))
              )}
            </div>
          </details>

          <input
            name="subject"
            placeholder="Subject"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <textarea
            name="message"
            placeholder="Write your message..."
            required
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Send email
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Sent history</h2>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No emails sent yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="pb-2 font-normal">Recipient</th>
                  <th className="pb-2 font-normal">Subject</th>
                  <th className="pb-2 font-normal">Status</th>
                  <th className="pb-2 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">
                      {h.recipientName ?? "—"}
                      <div className="text-xs text-white/40">{h.recipientEmail}</div>
                    </td>
                    <td className="py-2.5 text-white/60">{h.subject}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          h.status === "sent"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {h.status}
                      </span>
                      {h.error && <div className="mt-1 max-w-xs text-xs text-white/40">{h.error}</div>}
                    </td>
                    <td className="py-2.5 text-white/60">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
