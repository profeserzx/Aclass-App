import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Creating rate_limit_attempts table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "rate_limit_attempts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "key" varchar(255) NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log("Creating index...");
  await sql`CREATE INDEX IF NOT EXISTS "rate_limit_attempts_key_created_idx" ON "rate_limit_attempts" ("key", "created_at")`;

  console.log("Verifying...");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'rate_limit_attempts'`;
  console.log("rate_limit_attempts table present:", tables.length > 0);
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
