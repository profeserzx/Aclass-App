import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating leave_type and leave_status enums...");
  await sql`DO $$ BEGIN
    CREATE TYPE "leave_type" AS ENUM ('annual', 'sick', 'study', 'compassionate', 'other');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE "leave_status" AS ENUM ('pending', 'approved', 'rejected');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating leave_requests table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "leave_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "user_id" uuid NOT NULL,
      "leave_type" "leave_type" DEFAULT 'annual' NOT NULL,
      "start_date" date NOT NULL,
      "end_date" date NOT NULL,
      "reason" text,
      "status" "leave_status" DEFAULT 'pending' NOT NULL,
      "reviewed_by" uuid,
      "reviewed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_users_id_fk"
      FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'leave_requests'`;
  console.log("leave_requests table present:", tables.length > 0);
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
