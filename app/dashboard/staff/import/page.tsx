import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { importStaffAction } from "@/app/actions/importStaff";

export default async function ImportStaffPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; credentials?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/staff");

  const credentials = (searchParams.credentials || "")
    .split("|")
    .filter(Boolean)
    .map((pair) => {
      const [email, password] = pair.split(":");
      return { email, password };
    });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import staff</h1>
        <p className="mt-1 text-sm text-white/50">
          Bring in your existing teacher/staff list from a spreadsheet or another system's export.
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

      {credentials.length > 0 && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
          <h2 className="text-lg font-medium text-yellow-200">Share these logins now</h2>
          <p className="mt-1 text-sm text-yellow-200/70">
            These temporary passwords are shown only once — copy them down before leaving this page. Tell each
            staff member to log in and change their password as soon as possible.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-yellow-500/20 text-yellow-200/50">
                  <th className="pb-2 font-normal">Email</th>
                  <th className="pb-2 font-normal">Temporary password</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.email} className="border-b border-yellow-500/10 last:border-0">
                    <td className="py-2 text-white">{c.email}</td>
                    <td className="py-2 font-mono text-white/80">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-medium">Upload a CSV file</h2>
        <p className="mt-2 text-sm text-white/50">
          Needs a <code className="text-white/70">Name</code> column and an <code className="text-white/70">Email</code>{" "}
          column at minimum. An optional <code className="text-white/70">Role</code> column (Teacher / Dean / Deputy
          Principal) is recognized — anything unrecognized or blank defaults to Teacher. Each imported account gets a
          random temporary password, shown after import so you can share it.
        </p>
        <form action={importStaffAction} className="mt-4 space-y-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent2 sm:w-auto"
          >
            Import staff
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
        Not sure what your export looks like yet?{" "}
        <a href="/staff-import-template.csv" download className="text-accent hover:text-accent2">
          Download a template CSV
        </a>{" "}
        to see the expected shape.
      </div>

      <Link href="/dashboard/staff" className="inline-block text-sm text-white/50 hover:text-white">
        ← Back to staff
      </Link>
    </div>
  );
}
