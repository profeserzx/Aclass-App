import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adding new role values...");
  await sql`ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'dean'`;
  await sql`ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'deputy_principal'`;

  console.log("Creating subjects table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "subjects" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "name" text NOT NULL,
      "code" varchar(20) NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding columns to students...");
  await sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "admission_number" varchar(50)`;
  await sql`ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "guardian_email" varchar(255)`;

  console.log("Adding foreign key + indexes...");
  await sql`
    DO $$ BEGIN
      ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk"
        FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_code_idx" ON "subjects" USING btree ("school_id","code")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "students_school_admission_idx" ON "students" USING btree ("school_id","admission_number")`;

  console.log("Done. Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'students' AND column_name IN ('admission_number', 'guardian_email')
  `;
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'subjects'`;
  console.log("students columns present:", cols.map((c) => c.column_name));
  console.log("subjects table present:", tables.length > 0);
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
