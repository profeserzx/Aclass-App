import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adding email_logs.body column...");
  await sql`ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "body" text`;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'body'
  `;
  console.log("email_logs.body present:", cols.length > 0);
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
