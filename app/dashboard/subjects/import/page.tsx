import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { importSubjectsAction } from "@/app/actions/importSubjects";

export default async function ImportSubjectsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/subjects");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import subjects</h1>
        <p className="mt-1 text-sm text-white/50">
          Bring in your existing subject list from a spreadsheet or another system's export.
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
          Needs at minimum a <code className="text-white/70">Name</code> column. A <code className="text-white/70">Code</code>{" "}
          column is optional — if it's missing, blank, or clashes with one already in use, a code is generated
          automatically from the subject name (e.g. "Christian Religious Education" → "CRE"). Subjects with a name
          that already exists are skipped rather than duplicated.
        </p>
        <form action={importSubjectsAction} className="mt-4 space-y-3">
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
            Import subjects
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
        Not sure what your export looks like yet?{" "}
        <a href="/subjects-import-template.csv" download className="text-accent hover:text-accent2">
          Download a template CSV
        </a>{" "}
        to see the expected shape.
      </div>

      <Link href="/dashboard/subjects" className="inline-block text-sm text-white/50 hover:text-white">
        ← Back to subjects
      </Link>
    </div>
  );
}
