import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex");
}

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

async function configureMpesa() {
  const key = process.env.SCHOOL_MPESA_CONSUMER_KEY;
  const secret = process.env.SCHOOL_MPESA_CONSUMER_SECRET;
  const passkey = process.env.MPESA_PASSKEY;
  const shortcode = process.env.SCHOOL_MPESA_SHORTCODE;
  const env = process.env.SCHOOL_MPESA_ENV === "production" ? "production" : "sandbox";

  if (!key || !secret) {
    console.log("M-Pesa: no credentials found in env — skipping (configure from dashboard instead).");
    await pool.end();
    return;
  }

  if (!passkey) {
    console.log("M-Pesa: consumer key/secret found but PASSKEY missing — STK push won't work without it.");
    await pool.end();
    return;
  }

  const { rows } = await pool.query("SELECT id FROM schools WHERE slug = $1", ["demo-school"]);
  if (rows.length === 0) {
    console.log("M-Pesa: demo school not found — skipping.");
    await pool.end();
    return;
  }

  await pool.query(
    `UPDATE schools SET
       mpesa_env = $1,
       mpesa_shortcode = $2,
       mpesa_consumer_key = $3,
       mpesa_consumer_secret = $4,
       mpesa_passkey = $5
     WHERE slug = 'demo-school'`,
    [env, shortcode || null, key, encryptSecret(secret), encryptSecret(passkey)]
  );

  console.log(`M-Pesa: configured demo school (${env}, shortcode ${shortcode || "N/A"}).`);
  await pool.end();
}

configureMpesa().catch((e) => {
  console.error("M-Pesa config failed:", e.message);
  process.exit(0);
});
