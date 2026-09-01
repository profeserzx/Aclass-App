"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getSession } from "@/lib/session";

/** Same minimal CSV parser as the student/staff importers. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const FIELD_CANDIDATES: Record<string, string[]> = {
  name: ["name", "subject", "subjectname"],
  code: ["code", "subjectcode"],
};

function findColumn(normalizedHeaders: string[], field: string): number {
  const candidates = FIELD_CANDIDATES[field];
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Derives a short unique-ish code from a subject name, e.g. "Christian Religious Education" -> "CRE". */
function deriveCode(name: string, taken: Set<string>): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  let base: string;
  if (words.length >= 2) {
    base = words.map((w) => w[0]).join("").slice(0, 6);
  } else {
    base = (words[0] || "SUBJ").replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }
  if (!base) base = "SUBJ";

  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
}

export async function importSubjectsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/subjects?error=${encodeURIComponent("Only an admin can import subjects.")}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/subjects/import?error=${encodeURIComponent("Choose a CSV file first.")}`);
  }

  const text = await (file as File).text();
  const allRows = parseCSV(text);
  if (allRows.length < 2) {
    redirect(
      `/dashboard/subjects/import?error=${encodeURIComponent(
        "That file doesn't look like it has a header row plus data."
      )}`
    );
  }

  const [headerRow, ...dataRows] = allRows;
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const col = {
    name: findColumn(normalizedHeaders, "name"),
    code: findColumn(normalizedHeaders, "code"),
  };

  if (col.name === -1) {
    redirect(`/dashboard/subjects/import?error=${encodeURIComponent("Couldn't find a Name column.")}`);
  }

  const existing = await db.select().from(subjects).where(eq(subjects.schoolId, session.schoolId));
  const takenCodes = new Set(existing.map((s) => s.code.toUpperCase()));
  const takenNames = new Set(existing.map((s) => s.name.trim().toLowerCase()));

  let imported = 0;
  let skipped = 0;

  for (const r of dataRows) {
    const name = (r[col.name] || "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    if (takenNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }

    let code = col.code !== -1 ? (r[col.code] || "").trim().toUpperCase() : "";
    if (!code || takenCodes.has(code)) {
      code = deriveCode(name, takenCodes);
    }

    await db.insert(subjects).values({ schoolId: session.schoolId, name, code });
    takenCodes.add(code);
    takenNames.add(name.toLowerCase());
    imported++;
  }

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/grades");

  redirect(
    `/dashboard/subjects/import?success=${encodeURIComponent(
      `Imported ${imported} subject(s).${skipped > 0 ? ` Skipped ${skipped} row(s) — missing name or duplicate.` : ""}`
    )}`
  );
}
