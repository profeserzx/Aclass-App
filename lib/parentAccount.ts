import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, students, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * Auto-creates a parent login for a student, using their admission number as
 * both the email's local part and the initial password (parents can change
 * it from their dashboard). Requires the school to have a domain configured
 * and the student to have an admission number — otherwise this is a no-op.
 */
export async function provisionParentAccount(params: {
  schoolId: string;
  studentId: string;
  admissionNumber: string | null;
  guardianName: string | null;
}): Promise<{ created: boolean; email?: string }> {
  const { schoolId, studentId, admissionNumber, guardianName } = params;

  if (!admissionNumber) return { created: false };

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school?.domain) return { created: false };

  const localPart = admissionNumber.trim().toLowerCase().replace(/\s+/g, "");
  const email = `${localPart}@${school.domain}`;
  const passwordHash = await hashPassword(admissionNumber.trim());

  try {
    const [parentUser] = await db
      .insert(users)
      .values({
        schoolId,
        name: guardianName || `Parent of ${admissionNumber}`,
        email,
        passwordHash,
        role: "parent",
      })
      .returning();

    await db.update(students).set({ userId: parentUser.id }).where(eq(students.id, studentId));
    return { created: true, email };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // An account with this email already exists for the school (e.g. re-running
      // an import) — leave it as-is rather than erroring the whole operation out.
      return { created: false };
    }
    throw err;
  }
}
