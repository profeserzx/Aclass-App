"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, schools } from "@/db/schema";
import { getSession } from "@/lib/session";
import { provisionParentAccount } from "@/lib/parentAccount";
import { studentLimitFor } from "@/lib/plans";

/** Minimal CSV parser: handles quoted fields, escaped quotes, and CRLF/LF line endings. */
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
      // ignore, \n handles the line break
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

/** Accepts YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY; returns YYYY-MM-DD or null if unparseable. */
function parseDobToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

const FIELD_CANDIDATES: Record<string, string[]> = {
  firstName: ["firstname", "fname", "givenname"],
  lastName: ["lastname", "lname", "surname", "familyname"],
  fullName: ["name", "fullname", "studentname"],
  admissionNumber: ["admissionnumber", "admissionno", "admno", "regno", "registrationnumber"],
  grade: ["grade", "class", "classname", "gradelevel", "form", "stream"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "birthday"],
  guardianName: ["guardianname", "parentname", "fathername", "mothername"],
  guardianContact: ["guardianphone", "parentphone", "phone", "guardiancontact", "parentcontact", "mobile", "contact"],
  guardianEmail: ["guardianemail", "parentemail", "email"],
};

function findColumn(normalizedHeaders: string[], field: string): number {
  const candidates = FIELD_CANDIDATES[field];
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function importStudentsAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/students?error=${encodeURIComponent("Only an admin can import students.")}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/students/import?error=${encodeURIComponent("Choose a CSV file first.")}`);
  }

  const text = await (file as File).text();
  const allRows = parseCSV(text);
  if (allRows.length < 2) {
    redirect(
      `/dashboard/students/import?error=${encodeURIComponent(
        "That file doesn't look like it has a header row plus data."
      )}`
    );
  }

  const [headerRow, ...dataRows] = allRows;
  const normalizedHeaders = headerRow.map(normalizeHeader);

  const col = {
    firstName: findColumn(normalizedHeaders, "firstName"),
    lastName: findColumn(normalizedHeaders, "lastName"),
    fullName: findColumn(normalizedHeaders, "fullName"),
    admissionNumber: findColumn(normalizedHeaders, "admissionNumber"),
    grade: findColumn(normalizedHeaders, "grade"),
    dateOfBirth: findColumn(normalizedHeaders, "dateOfBirth"),
    guardianName: findColumn(normalizedHeaders, "guardianName"),
    guardianContact: findColumn(normalizedHeaders, "guardianContact"),
    guardianEmail: findColumn(normalizedHeaders, "guardianEmail"),
  };

  if (col.firstName === -1 && col.fullName === -1) {
    redirect(
      `/dashboard/students/import?error=${encodeURIComponent(
        "Couldn't find a name column. Include a 'First Name'/'Last Name' pair or a single 'Name' column."
      )}`
    );
  }

  // Pass 1: make sure every grade/class mentioned in the file exists, creating any that don't.
  const existingClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, session.schoolId));
  const classIdByName = new Map(existingClasses.map((c) => [c.name.trim().toLowerCase(), c.id]));

  if (col.grade !== -1) {
    const distinctGrades = new Set(
      dataRows.map((r) => (r[col.grade] || "").trim()).filter((g) => g.length > 0)
    );
    for (const gradeName of distinctGrades) {
      const key = gradeName.toLowerCase();
      if (!classIdByName.has(key)) {
        const [created] = await db
          .insert(classes)
          .values({ schoolId: session.schoolId, name: gradeName })
          .returning();
        classIdByName.set(key, created.id);
      }
    }
  }

  // Respect the Starter plan's student cap — import only as many rows as fit,
  // rather than failing the whole batch or silently going over the limit.
  const [[school], [{ value: currentCount }]] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, session.schoolId)).limit(1),
    db.select({ value: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, session.schoolId)),
  ]);
  const limit = studentLimitFor(school ?? { plan: "starter" });
  const remainingSlots = limit !== null ? Math.max(limit - currentCount, 0) : Infinity;
  const rowsOverLimit = limit !== null ? Math.max(dataRows.length - remainingSlots, 0) : 0;
  const rowsToImport = limit !== null ? dataRows.slice(0, remainingSlots) : dataRows;

  // Pass 2: insert students one at a time so a single bad row (e.g. duplicate
  // admission number) doesn't take the whole batch down with it.
  let imported = 0;
  let skipped = 0;

  for (const r of rowsToImport) {
    let firstName = "";
    let lastName = "";
    if (col.firstName !== -1 && col.lastName !== -1) {
      firstName = (r[col.firstName] || "").trim();
      lastName = (r[col.lastName] || "").trim();
    } else if (col.fullName !== -1) {
      const full = (r[col.fullName] || "").trim();
      const parts = full.split(/\s+/);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || parts[0] || "";
    }

    if (!firstName || !lastName) {
      skipped++;
      continue;
    }

    const gradeName = col.grade !== -1 ? (r[col.grade] || "").trim() : "";
    const classId = gradeName ? classIdByName.get(gradeName.toLowerCase()) ?? null : null;
    const admissionNumber =
      col.admissionNumber !== -1 ? (r[col.admissionNumber] || "").trim() || null : null;
    const guardianName = col.guardianName !== -1 ? (r[col.guardianName] || "").trim() || null : null;
    const dateOfBirth =
      col.dateOfBirth !== -1 ? parseDobToIso(r[col.dateOfBirth] || "") : null;

    try {
      const [created] = await db
        .insert(students)
        .values({
          schoolId: session.schoolId,
          firstName,
          lastName,
          classId,
          admissionNumber,
          dateOfBirth,
          guardianName,
          guardianContact:
            col.guardianContact !== -1 ? (r[col.guardianContact] || "").trim() || null : null,
          guardianEmail: col.guardianEmail !== -1 ? (r[col.guardianEmail] || "").trim() || null : null,
        })
        .returning();
      imported++;

      // Same auto-provisioning as the single-add form — silently skipped if the
      // school has no domain set or this row has no admission number.
      await provisionParentAccount({
        schoolId: session.schoolId,
        studentId: created.id,
        admissionNumber,
        guardianName,
      });
    } catch {
      skipped++;
    }
  }

  // The imported students need to show up on other routes too, not just the
  // one we're redirecting to.
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/grades");

  redirect(
    `/dashboard/students/import?success=${encodeURIComponent(
      `Imported ${imported} student(s).${skipped > 0 ? ` Skipped ${skipped} row(s) — missing names or duplicate admission numbers.` : ""}${
        rowsOverLimit > 0
          ? ` Stopped ${rowsOverLimit} row(s) short — your Starter plan is capped at ${limit} students. Upgrade to Growth on the Billing page to import the rest.`
          : ""
      }`
    )}`
  );
}
