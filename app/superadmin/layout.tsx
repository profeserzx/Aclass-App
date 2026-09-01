import { requireSuperadmin } from "@/lib/superadmin";
import { logoutAction } from "@/app/actions/auth";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadmin();

  return (
    <div className="min-h-screen bg-ink bg-grid-glow text-white">
      <header className="border-b border-amber-400/20 bg-amber-400/[0.03]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-12 w-auto" />
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Superadmin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-medium text-white">{session.name}</div>
              <div className="text-white/40">Aclass staff</div>
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
      {children}
    </div>
  );
}
