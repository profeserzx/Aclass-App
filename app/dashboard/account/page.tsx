import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { changePasswordAction } from "@/app/actions/auth";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <p className="mt-1 text-sm text-white/50">
          Signed in as {session.name} ({session.role}).
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Change password</h2>
        <p className="mt-1 text-sm text-white/50">
          If you were given a temporary password when your account was created, change it here.
        </p>
        <form action={changePasswordAction} className="mt-4 space-y-3">
          <input
            name="currentPassword"
            type="password"
            placeholder="Current password"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New password"
            required
            minLength={8}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            required
            minLength={8}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
