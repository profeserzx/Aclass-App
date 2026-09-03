import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";
import DashboardNav from "@/app/dashboard/DashboardNav";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [[school], [user]] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1),
    db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1),
  ]);
  // Superadmins don't get a per-school dashboard at all — this whole view is
  // irrelevant to them (their "school" is just a throwaway account shell), so
  // send them straight to the cross-school panel instead.
  if (user && isSuperadminEmail(user.email)) {
    redirect("/superadmin");
  }

  return (
    <div className="min-h-screen bg-ink bg-grid-glow text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-12 w-auto" />
            <span className="hidden text-sm text-white/40 sm:inline">/ {school?.name ?? "Your school"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-medium text-white">{session.name}</div>
              <div className="capitalize text-white/40">{session.role}</div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-10">
        <aside className="hidden w-56 shrink-0 md:block">
          <DashboardNav role={session.role} schoolType={school?.schoolType ?? "high"} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
