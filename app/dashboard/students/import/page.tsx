import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { importStudentsAction } from "@/app/actions/import";

export default async function ImportStudentsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/students");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import students</h1>
        <p className="mt-1 text-sm text-white/50">
          Bring in your existing student list from a spreadsheet or another system's export.
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
        <h2 className="text-lg font-medium">Upload a CSV file</h2>
        <p className="mt-2 text-sm text-white/50">
          Column names are matched flexibly — things like <code className="text-white/70">First Name</code>,{" "}
          <code className="text-white/70">admission_no</code>, or <code className="text-white/70">Grade</code> are
          all recognized. At minimum you need either a first/last name pair or a single name column. Any grade or
          class mentioned that doesn't exist yet will be created automatically.
        </p>
        <form action={importStudentsAction} className="mt-4 space-y-3">
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
            Import students
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
        Not sure what your export looks like yet?{" "}
        <a href="/students-import-template.csv" download className="text-accent hover:text-accent2">
          Download a template CSV
        </a>{" "}
        to see the expected shape, or just try uploading your existing export directly — most common column
        names are recognized automatically.
      </div>

      <Link href="/dashboard/students" className="inline-block text-sm text-white/50 hover:text-white">
        ← Back to students
      </Link>
    </div>
  );
}
