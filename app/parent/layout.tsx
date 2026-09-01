import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "parent") {
    redirect("/login");
  }

  const [school] = await db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1);

  return (
    <div className="min-h-screen bg-ink bg-grid-glow text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-12 w-auto" />
            <span className="hidden text-sm text-white/40 sm:inline">/ {school?.name ?? "Your school"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-medium text-white">{session.name}</div>
              <div className="text-white/40">Parent</div>
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
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
