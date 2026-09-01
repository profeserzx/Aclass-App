import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating attendance_status enum...");
  await sql`DO $$ BEGIN
    CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating attendance table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "attendance" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "student_id" uuid NOT NULL,
      "class_id" uuid NOT NULL,
      "date" date NOT NULL,
      "status" "attendance_status" DEFAULT 'present' NOT NULL,
      "recorded_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Creating grades table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "grades" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "student_id" uuid NOT NULL,
      "subject" text NOT NULL,
      "term" varchar(50) NOT NULL,
      "score" numeric(6, 2) NOT NULL,
      "max_score" numeric(6, 2) DEFAULT '100' NOT NULL,
      "recorded_by" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_classes_id_fk"
      FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_users_id_fk"
      FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "grades" ADD CONSTRAINT "grades_recorded_by_users_id_fk"
      FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Adding unique indexes (for upsert-on-re-entry)...");
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "attendance_student_date_idx" ON "attendance" ("student_id", "date")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "grades_student_subject_term_idx" ON "grades" ("student_id", "subject", "term")`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name IN ('attendance', 'grades')`;
  console.log("Tables present:", tables.map((t) => t.table_name));
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
