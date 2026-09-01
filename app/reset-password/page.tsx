import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/passwordReset";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = searchParams.token || "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-grid-glow px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-9 w-auto" />
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Set a new password</h1>

          {!token ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              This link is missing its reset token.{" "}
              <Link href="/forgot-password" className="underline">
                Request a new one
              </Link>
              .
            </div>
          ) : (
            <>
              {searchParams.error && (
                <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {searchParams.error}
                </div>
              )}

              <form action={resetPasswordAction} className="mt-6 space-y-4">
                <input type="hidden" name="token" value={token} />
                <div>
                  <label htmlFor="newPassword" className="mb-1.5 block text-sm text-white/70">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-sm text-white/70">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Retype the password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none transition focus:border-accent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-accent2"
                >
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
