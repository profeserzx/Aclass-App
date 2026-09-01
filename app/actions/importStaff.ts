"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

const STAFF_ROLES = ["teacher", "dean", "deputy_principal"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

/** Same minimal CSV parser as the student importer (handles quotes, CRLF/LF). */
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
  name: ["name", "fullname", "staffname", "teachername"],
  email: ["email", "emailaddress"],
  role: ["role", "position", "title", "jobtitle"],
};

function findColumn(normalizedHeaders: string[], field: string): number {
  const candidates = FIELD_CANDIDATES[field];
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalizeRole(raw: string): StaffRole {
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "dean") return "dean";
  if (key === "deputyprincipal" || key === "deputy" || key === "dp") return "deputy_principal";
  return "teacher"; // safe default — the most common staff row by far
}

function randomTempPassword(): string {
  // 10 chars, alnum only, easy to read aloud/type — this is a one-time
  // credential the admin hands to the staff member, not a long-term secret.
  return crypto.randomBytes(8).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function importStaffAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(`/dashboard/staff?error=${encodeURIComponent("Only an admin can import staff.")}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/staff/import?error=${encodeURIComponent("Choose a CSV file first.")}`);
  }

  const text = await (file as File).text();
  const allRows = parseCSV(text);
  if (allRows.length < 2) {
    redirect(
      `/dashboard/staff/import?error=${encodeURIComponent(
        "That file doesn't look like it has a header row plus data."
      )}`
    );
  }

  const [headerRow, ...dataRows] = allRows;
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const col = {
    name: findColumn(normalizedHeaders, "name"),
    email: findColumn(normalizedHeaders, "email"),
    role: findColumn(normalizedHeaders, "role"),
  };

  if (col.name === -1 || col.email === -1) {
    redirect(
      `/dashboard/staff/import?error=${encodeURIComponent(
        "Couldn't find both a Name column and an Email column."
      )}`
    );
  }

  let imported = 0;
  let skipped = 0;
  const credentials: { email: string; password: string }[] = [];

  for (const r of dataRows) {
    const name = (r[col.name] || "").trim();
    const email = (r[col.email] || "").trim().toLowerCase();
    const role = col.role !== -1 ? normalizeRole(r[col.role] || "") : "teacher";

    if (!name || !email) {
      skipped++;
      continue;
    }

    const tempPassword = randomTempPassword();
    try {
      await db.insert(users).values({
        schoolId: session.schoolId,
        name,
        email,
        passwordHash: await hashPassword(tempPassword),
        role,
      });
      imported++;
      credentials.push({ email, password: tempPassword });
    } catch (err) {
      if (isUniqueViolation(err)) {
        skipped++;
        continue;
      }
      throw err;
    }
  }

  revalidatePath("/dashboard/staff");

  // Temp passwords only ever exist in memory for this one request — they're
  // relayed back via the redirect so the admin can copy them down, then
  // they're gone. Staff should change their password on first login.
  const credentialsParam = encodeURIComponent(
    credentials.map((c) => `${c.email}:${c.password}`).join("|")
  );

  redirect(
    `/dashboard/staff/import?success=${encodeURIComponent(
      `Imported ${imported} staff account(s).${skipped > 0 ? ` Skipped ${skipped} row(s) — missing name/email or already registered.` : ""}`
    )}&credentials=${credentialsParam}`
  );
}
