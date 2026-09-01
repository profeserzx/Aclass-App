import crypto from "crypto";

// Used to encrypt per-school secrets we have to store in plaintext-recoverable
// form (Daraja Consumer Secret, Passkey) — unlike a login password, these need
// to be decrypted back to their original value to call Safaricom's API, so
// they can't be hashed like bcrypt does for user passwords. This is a basic
// at-rest protection (the DB no longer holds the secret in the clear) — for a
// larger production rollout, consider a dedicated secrets manager instead.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY is not set in .env.local. Generate one with: openssl rand -hex 32"
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return buf;
}

/** Encrypts a string for storage. Returns "iv:authTag:ciphertext", all hex. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Reverses encryptSecret(). Throws if the value is malformed or the key is wrong. */
export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
