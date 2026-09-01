import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating password_reset_tokens table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "token_hash" varchar(64) NOT NULL,
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Adding foreign key...");
  await sql`DO $$ BEGIN
    ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  console.log("Adding unique index on token_hash...");
  await sql`DO $$ BEGIN
    CREATE UNIQUE INDEX "password_reset_tokens_hash_idx" ON "password_reset_tokens" ("token_hash");
  EXCEPTION WHEN duplicate_table THEN null; END $$`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'password_reset_tokens'`;
  console.log("password_reset_tokens table present:", tables.length > 0);
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
