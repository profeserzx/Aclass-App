import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // schema.ts has declared students.dateOfBirth since early on, but no
  // migration script ever actually added it to the live table (it must have
  // been added to schema.ts after the initial `drizzle-kit push`). This is
  // idempotent either way.
  console.log("Ensuring students.date_of_birth column exists...");
  await sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "date_of_birth" date`;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'date_of_birth'
  `;
  console.log("students.date_of_birth present:", cols.length > 0);
}

run()
  .then(() => {
    console.log("Migration complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
