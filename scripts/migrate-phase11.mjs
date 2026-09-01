import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating stk_push_status enum...");
  await sql`DO $$ BEGIN
    CREATE TYPE "stk_push_status" AS ENUM ('pending', 'success', 'failed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating stk_push_requests table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "stk_push_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "fee_id" uuid NOT NULL,
      "initiated_by" uuid,
      "phone_number" varchar(15) NOT NULL,
      "amount" numeric(10, 2) NOT NULL,
      "merchant_request_id" varchar(100),
      "checkout_request_id" varchar(100),
      "status" "stk_push_status" DEFAULT 'pending' NOT NULL,
      "result_code" varchar(10),
      "result_desc" text,
      "mpesa_receipt_number" varchar(50),
      "payment_id" uuid,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "completed_at" timestamp
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "stk_push_requests" ADD CONSTRAINT "stk_push_requests_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "stk_push_requests" ADD CONSTRAINT "stk_push_requests_fee_id_fees_id_fk"
      FOREIGN KEY ("fee_id") REFERENCES "public"."fees"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "stk_push_requests" ADD CONSTRAINT "stk_push_requests_initiated_by_users_id_fk"
      FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "stk_push_requests" ADD CONSTRAINT "stk_push_requests_payment_id_payments_id_fk"
      FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'stk_push_requests'`;
  console.log("stk_push_requests table present:", tables.length > 0);
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
