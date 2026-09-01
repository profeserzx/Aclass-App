import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { importClassesAction } from "@/app/actions/importClasses";

export default async function ImportClassesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard/classes");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import classes</h1>
        <p className="mt-1 text-sm text-white/50">
          Bring in your school's existing classes/streams in one go — handy if you run several streams per grade
          (e.g. "Form 3 West", "Form 3 Meridian", "Form 3 Red") rather than just one class per level.
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
          Needs a <code className="text-white/70">Name</code> column (the class/stream name, e.g. "Form 3 West" or
          "Grade 7 East" — this is what shows up everywhere). A <code className="text-white/70">Grade Level</code>{" "}
          column is optional (e.g. "Form 3" or "Grade 7"). A <code className="text-white/70">Teacher Email</code>{" "}
          column is also optional — if it matches an existing staff account's email, that person is set as the
          class teacher; if it doesn't match anyone yet, the class is still created, just without one assigned.
          Import staff first if you want class teachers linked automatically. A class with a name that already
          exists is skipped, not duplicated.
        </p>
        <form action={importClassesAction} className="mt-4 space-y-3">
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
            Import classes
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
        Not sure what your export looks like yet?{" "}
        <a href="/classes-import-template.csv" download className="text-accent hover:text-accent2">
          Download a template CSV
        </a>{" "}
        to see the expected shape.
      </div>

      <Link href="/dashboard/classes" className="inline-block text-sm text-white/50 hover:text-white">
        ← Back to classes
      </Link>
    </div>
  );
}
