import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

// One-off data fix: the School domain field previously had no validation
// against someone pasting a full example login (e.g. "1834@dawamu.ac.ke")
// instead of just the domain ("dawamu.ac.ke"). That produced doubled-up
// parent login emails like "1835@1835@dawamu.ac.ke". This script:
//   1. Fixes any school.domain that still contains an "@".
//   2. Recomputes every parent user's email from their child's admission
//      number + the corrected domain, and updates it if it's wrong.

async function run() {
  const schools = await sql`SELECT id, domain FROM schools`;

  for (const school of schools) {
    if (!school.domain) continue;

    let domain = school.domain;
    if (domain.includes("@")) {
      const fixed = domain.split("@").pop();
      console.log(`School ${school.id}: domain "${domain}" -> "${fixed}"`);
      await sql`UPDATE schools SET domain = ${fixed} WHERE id = ${school.id}`;
      domain = fixed;
    }

    const students = await sql`
      SELECT s.id AS student_id, s.admission_number, s.user_id, u.email AS current_email
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.school_id = ${school.id}
        AND s.admission_number IS NOT NULL
        AND s.user_id IS NOT NULL
        AND u.role = 'parent'
    `;

    let fixed = 0;
    let skipped = 0;

    for (const row of students) {
      const localPart = row.admission_number.trim().toLowerCase().replace(/\s+/g, "");
      const correctEmail = `${localPart}@${domain}`;
      if (row.current_email === correctEmail) continue;

      try {
        await sql`UPDATE users SET email = ${correctEmail} WHERE id = ${row.user_id}`;
        console.log(`  Fixed parent login for student ${row.student_id}: "${row.current_email}" -> "${correctEmail}"`);
        fixed++;
      } catch (err) {
        console.error(
          `  Could not fix student ${row.student_id} (${row.current_email} -> ${correctEmail}):`,
          err.message || err
        );
        skipped++;
      }
    }

    console.log(`School ${school.id}: ${fixed} email(s) fixed, ${skipped} skipped.`);
  }
}

run()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
