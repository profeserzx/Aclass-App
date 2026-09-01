"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, users } from "@/db/schema";
import { getSession } from "@/lib/session";

/** Same minimal CSV parser as the student/staff/subjects importers. */
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
  name: ["name", "class", "classname", "stream", "streamname"],
  gradeLevel: ["gradelevel", "grade", "form", "level"],
  teacherEmail: ["teacheremail", "classteacheremail", "teacher"],
};

function findColumn(normalizedHeaders: string[], field: string): number {
  const candidates = FIELD_CANDIDATES[field];
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function importClassesAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/classes?error=${encodeURIComponent("Only an admin can import classes.")}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/classes/import?error=${encodeURIComponent("Choose a CSV file first.")}`);
  }

  const text = await (file as File).text();
  const allRows = parseCSV(text);
  if (allRows.length < 2) {
    redirect(
      `/dashboard/classes/import?error=${encodeURIComponent(
        "That file doesn't look like it has a header row plus data."
      )}`
    );
  }

  const [headerRow, ...dataRows] = allRows;
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const col = {
    name: findColumn(normalizedHeaders, "name"),
    gradeLevel: findColumn(normalizedHeaders, "gradeLevel"),
    teacherEmail: findColumn(normalizedHeaders, "teacherEmail"),
  };

  if (col.name === -1) {
    redirect(
      `/dashboard/classes/import?error=${encodeURIComponent(
        "Couldn't find a Name/Class/Stream column — that's the one required field."
      )}`
    );
  }

  // Every teacher/dean/deputy in the school, so "teacher email" cells can be
  // matched without a query per row.
  const staffRows = await db.select().from(users).where(eq(users.schoolId, session.schoolId));
  const staffIdByEmail = new Map(staffRows.map((u) => [u.email.toLowerCase(), u.id]));

  const existing = await db.select().from(classes).where(eq(classes.schoolId, session.schoolId));
  const takenNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let teacherNotFound = 0;

  for (const r of dataRows) {
    const name = (r[col.name] || "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    if (takenNames.has(name.toLowerCase())) {
      // Schools often have several streams per grade (Form 3 West, Form 3
      // Meridian, Form 3 Red, etc) — those are distinct names and won't
      // collide here. This only skips an exact duplicate name.
      skipped++;
      continue;
    }

    const gradeLevel = col.gradeLevel !== -1 ? (r[col.gradeLevel] || "").trim() || null : null;
    const teacherEmailRaw = col.teacherEmail !== -1 ? (r[col.teacherEmail] || "").trim().toLowerCase() : "";
    let teacherId: string | null = null;
    if (teacherEmailRaw) {
      const matched = staffIdByEmail.get(teacherEmailRaw);
      if (matched) {
        teacherId = matched;
      } else {
        teacherNotFound++;
      }
    }

    await db.insert(classes).values({ schoolId: session.schoolId, name, gradeLevel, teacherId });
    takenNames.add(name.toLowerCase());
    imported++;
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard");

  const notes: string[] = [];
  if (skipped > 0) notes.push(`${skipped} row(s) skipped — missing name or duplicate class name.`);
  if (teacherNotFound > 0) {
    notes.push(
      `${teacherNotFound} teacher email(s) didn't match an existing staff account — those classes were created without a class teacher.`
    );
  }

  redirect(
    `/dashboard/classes/import?success=${encodeURIComponent(
      `Imported ${imported} class(es).${notes.length > 0 ? " " + notes.join(" ") : ""}`
    )}`
  );
}
