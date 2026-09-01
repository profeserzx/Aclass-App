import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adding schools.tagline column...");
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tagline" varchar(255)`;

  console.log("Backfilling Dawamu School's existing tagline...");
  await sql`
    UPDATE "schools" SET "tagline" = 'Transforming Boys Into Leaders'
    WHERE "tagline" IS NULL AND "name" ILIKE '%dawamu%'
  `;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name = 'tagline'
  `;
  console.log("schools.tagline present:", cols.length > 0);
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
