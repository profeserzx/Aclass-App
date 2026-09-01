import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating payment_claim_status enum...");
  await sql`DO $$ BEGIN
    CREATE TYPE "payment_claim_status" AS ENUM ('pending', 'approved', 'rejected');
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Creating payment_claims table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "payment_claims" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "school_id" uuid NOT NULL,
      "fee_id" uuid NOT NULL,
      "submitted_by" uuid,
      "amount" numeric(10, 2) NOT NULL,
      "method" "payment_method" DEFAULT 'mpesa' NOT NULL,
      "transaction_ref" varchar(100) NOT NULL,
      "status" "payment_claim_status" DEFAULT 'pending' NOT NULL,
      "review_note" text,
      "reviewed_by" uuid,
      "reviewed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign keys...");
  await sql`DO $$ BEGIN
    ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_school_id_schools_id_fk"
      FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_fee_id_fees_id_fk"
      FOREIGN KEY ("fee_id") REFERENCES "public"."fees"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_submitted_by_users_id_fk"
      FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_reviewed_by_users_id_fk"
      FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'payment_claims'`;
  console.log("payment_claims table present:", tables.length > 0);
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
