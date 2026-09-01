import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-grid-glow px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-9 w-auto" />
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-white/60">Log in to your school&apos;s Aclass workspace.</p>

          {searchParams.error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}
          {searchParams.success && (
            <div className="mt-6 rounded-xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
              {searchParams.success}
            </div>
          )}

          <form action={loginAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-white/70">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@school.ac.ke"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm text-white/70">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-accent hover:text-accent2">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Your password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Log in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            Don&apos;t have a workspace yet?{" "}
            <Link href="/signup" className="text-accent hover:text-accent2">
              Set up your school
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
