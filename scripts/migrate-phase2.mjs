import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Adding 'cheque' payment method...");
  await sql`ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'cheque'`;

  console.log("Adding term column to fees...");
  await sql`ALTER TABLE "fees" ADD COLUMN IF NOT EXISTS "term" varchar(50)`;

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'fees' AND column_name = 'term'
  `;
  const enumValues = await sql`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'payment_method'
  `;
  console.log("fees.term present:", cols.length > 0);
  console.log("payment_method values:", enumValues.map((e) => e.enumlabel));
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
