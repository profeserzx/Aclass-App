import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

function encryptSecret(plaintext) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set in .env.local.");
  const keyBuf = Buffer.from(key, "hex");
  if (keyBuf.length !== 32) throw new Error("ENCRYPTION_KEY must be a 64-character hex string.");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

async function run() {
  console.log("Adding per-school M-Pesa columns...");
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "mpesa_env" varchar(20) DEFAULT 'sandbox'`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "mpesa_shortcode" varchar(20)`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "mpesa_consumer_key" text`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "mpesa_consumer_secret" text`;
  await sql`ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "mpesa_passkey" text`;

  const { MPESA_ENV, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } =
    process.env;

  if (MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET && MPESA_SHORTCODE && MPESA_PASSKEY) {
    console.log("Backfilling Dawamu School's existing sandbox M-Pesa credentials...");
    const encryptedSecret = encryptSecret(MPESA_CONSUMER_SECRET);
    const encryptedPasskey = encryptSecret(MPESA_PASSKEY);

    const result = await sql`
      UPDATE "schools"
      SET
        "mpesa_env" = ${MPESA_ENV || "sandbox"},
        "mpesa_shortcode" = ${MPESA_SHORTCODE},
        "mpesa_consumer_key" = ${MPESA_CONSUMER_KEY},
        "mpesa_consumer_secret" = ${encryptedSecret},
        "mpesa_passkey" = ${encryptedPasskey}
      WHERE "name" ILIKE '%dawamu%' AND "mpesa_consumer_key" IS NULL
      RETURNING id, name
    `;
    console.log("Backfilled schools:", result.map((r) => r.name));
  } else {
    console.log("No MPESA_* env vars found to backfill — skipping (fine for a fresh install).");
  }

  console.log("Verifying...");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'schools' AND column_name LIKE 'mpesa_%'
  `;
  console.log(
    "mpesa columns present:",
    cols.map((c) => c.column_name)
  );
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
