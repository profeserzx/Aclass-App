import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adding domain column to schools...");
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "domain" varchar(255)`;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name = 'domain'
  `;
  console.log("schools.domain present:", cols.length > 0);
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
