import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createStaffAction, deleteStaffAction } from "@/app/actions/staff";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  dean: "Dean",
  deputy_principal: "Deputy Principal",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "admin";

  const staffRows = await db
    .select()
    .from(users)
    .where(eq(users.schoolId, session.schoolId))
    .orderBy(desc(users.createdAt));

  const staffOnly = staffRows.filter((u) => u.role !== "admin" && u.role !== "parent" && u.role !== "student");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-white/50">{staffOnly.length} staff account(s)</p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/staff/import"
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

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          {staffOnly.length === 0 ? (
            <p className="text-sm text-white/40">No staff accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="pb-2 font-normal">Name</th>
                    <th className="pb-2 font-normal">Email</th>
                    <th className="pb-2 font-normal">Role</th>
                    {isAdmin && <th className="pb-2 font-normal"></th>}
                  </tr>
                </thead>
                <tbody>
                  {staffOnly.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">{u.name}</td>
                      <td className="py-2.5 text-white/60">{u.email}</td>
                      <td className="py-2.5 text-white/60">{ROLE_LABELS[u.role] ?? u.role}</td>
                      {isAdmin && (
                        <td className="py-2.5 text-right">
                          <form action={deleteStaffAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" className="text-red-400 hover:text-red-300">
                              Remove
                            </button>
                          </form>
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
            <h2 className="text-lg font-medium">Add staff</h2>
            <form action={createStaffAction} className="mt-4 space-y-3">
              <input
                name="name"
                placeholder="Full name"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <input
                name="password"
                type="password"
                placeholder="Temporary password"
                required
                minLength={8}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
              />
              <select
                name="role"
                defaultValue="teacher"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                <option value="teacher" className="bg-ink">
                  Teacher
                </option>
                <option value="dean" className="bg-ink">
                  Dean
                </option>
                <option value="deputy_principal" className="bg-ink">
                  Deputy Principal
                </option>
              </select>
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
              >
                Add staff member
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
