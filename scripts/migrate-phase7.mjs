import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating discipline_status enum...");
  await sql`DO $$ BEGIN
    CREATE TYPE "discipline_status" AS ENUM ('open', 'closed');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating discipline_cases table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "discipline_cases" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "student_id" uuid NOT NULL,
      "reported_by" uuid,
      "incident_date" date NOT NULL,
      "offense" text NOT NULL,
      "description" text,
      "action_taken" text,
      "status" "discipline_status" DEFAULT 'open' NOT NULL,
      "closed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_student_id_students_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "discipline_cases" ADD CONSTRAINT "discipline_cases_reported_by_users_id_fk"
      FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'discipline_cases'`;
  console.log("discipline_cases table present:", tables.length > 0);
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
