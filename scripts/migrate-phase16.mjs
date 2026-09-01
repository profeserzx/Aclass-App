import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating plan / subscription_status enums...");
  await sql`DO $$ BEGIN
    CREATE TYPE "plan" AS ENUM ('starter', 'growth', 'district');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    CREATE TYPE "subscription_status" AS ENUM ('active', 'past_due', 'none');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Adding plan/subscription columns to schools...");
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "plan" "plan" DEFAULT 'starter' NOT NULL`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "subscription_status" "subscription_status" DEFAULT 'none' NOT NULL`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp`;

  console.log("Creating platform_stk_push_requests table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_stk_push_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "plan" "plan" NOT NULL,
      "initiated_by" uuid,
      "phone_number" varchar(15) NOT NULL,
      "amount" numeric(10, 2) NOT NULL,
      "merchant_request_id" varchar(100),
      "checkout_request_id" varchar(100),
      "status" "stk_push_status" DEFAULT 'pending' NOT NULL,
      "result_code" varchar(10),
      "result_desc" text,
      "mpesa_receipt_number" varchar(50),
      "created_at" timestamp DEFAULT now() NOT NULL,
      "completed_at" timestamp
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "platform_stk_push_requests" ADD CONSTRAINT "platform_stk_push_requests_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "platform_stk_push_requests" ADD CONSTRAINT "platform_stk_push_requests_initiated_by_users_id_fk"
      FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name IN ('plan', 'subscription_status', 'current_period_end')
  `;
  console.log("schools plan columns present:", cols.map((c) => c.column_name));
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'platform_stk_push_requests'`;
  console.log("platform_stk_push_requests table present:", tables.length > 0);
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
