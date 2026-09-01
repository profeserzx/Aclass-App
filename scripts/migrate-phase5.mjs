import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating email_status enum...");
  await sql`DO $$ BEGIN
    CREATE TYPE "email_status" AS ENUM ('sent', 'failed');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating email_logs table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "email_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "sent_by" uuid,
      "recipient_email" varchar(255) NOT NULL,
      "recipient_name" text,
      "subject" text NOT NULL,
      "status" "email_status" DEFAULT 'sent' NOT NULL,
      "error" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_sent_by_users_id_fk"
      FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'email_logs'`;
  console.log("email_logs table present:", tables.length > 0);
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
