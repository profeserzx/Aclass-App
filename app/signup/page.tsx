import Link from "next/link";
import { signupAction } from "@/app/actions/auth";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-grid-glow px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-9 w-auto" />
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Set up your school</h1>
          <p className="mt-2 text-sm text-white/60">
            Create a workspace for your school. You&apos;ll be the first admin.
          </p>

          {searchParams.error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {searchParams.error}
            </div>
          )}

          <form action={signupAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="schoolName" className="mb-1.5 block text-sm text-white/70">
                School name
              </label>
              <input
                id="schoolName"
                name="schoolName"
                type="text"
                required
                placeholder="Dawamu School"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="adminName" className="mb-1.5 block text-sm text-white/70">
                Your name
              </label>
              <input
                id="adminName"
                name="adminName"
                type="text"
                required
                placeholder="Jane Wanjiru"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
              />
            </div>
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
              <label htmlFor="password" className="mb-1.5 block text-sm text-white/70">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-white/60">
              <input
                type="checkbox"
                name="agreeToTerms"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-accent"
              />
              <span>
                I agree to Aclass's{" "}
                <Link href="/terms" target="_blank" className="text-accent hover:text-accent2">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-accent hover:text-accent2">
                  Privacy Policy
                </Link>
                , including how student and guardian data is handled.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-accent2"
            >
              Create workspace
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:text-accent2">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
