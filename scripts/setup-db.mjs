import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Returns true when the object a statement creates already exists, so the
// statement can be skipped without ever hitting a Postgres error.
async function alreadyApplied(stmt) {
  let m;
  if ((m = stmt.match(/^CREATE TYPE\s+"?(?:public"?\."?)?"?(\w+)"?\s/i))) {
    const { rows } = await pool.query("SELECT 1 FROM pg_type WHERE typname = $1", [m[1]]);
    return rows.length > 0;
  }
  if ((m = stmt.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(?:public"?\."?)?"?(\w+)"?\s/i))) {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
      [m[1]]
    );
    return rows.length > 0;
  }
  if ((m = stmt.match(/^ALTER TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+"?(\w+)"?\s/i))) {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
      [m[1], m[2]]
    );
    return rows.length > 0;
  }
  if ((m = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?\s/i))) {
    const { rows } = await pool.query("SELECT 1 FROM pg_indexes WHERE indexname = $1", [m[1]]);
    return rows.length > 0;
  }
  return false;
}

async function setupDb() {
  const migrationsDir = join(process.cwd(), "db", "migrations");
  let sqlFiles;
  try {
    sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    console.log("No migrations directory found — skipping schema setup.");
    await pool.end();
    return;
  }

  if (sqlFiles.length === 0) {
    console.log("No SQL migration files found — skipping schema setup.");
    await pool.end();
    return;
  }

  // Create a migrations tracking table so we only apply each migration once.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations_applied (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  for (const file of sqlFiles) {
    const { rows } = await pool.query(
      "SELECT 1 FROM __drizzle_migrations_applied WHERE filename = $1",
      [file]
    );
    if (rows.length > 0) {
      console.log(`Already applied: ${file}`);
      continue;
    }

    console.log(`Running migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      // Pre-check common "already exists" cases so we never send a statement
      // Postgres will reject (rejected statements clutter the DB error log
      // even when the client handles them gracefully).
      if (await alreadyApplied(stmt)) {
        console.log(`  Skipping (already in schema): ${stmt.substring(0, 80).replace(/\n/g, " ")}...`);
        continue;
      }
      try {
        await pool.query(stmt);
      } catch (err) {
        // Fallback idempotency for cases the pre-check doesn't cover.
        if (err.message.includes("already exists") || err.message.includes("does not exist")) {
          console.log(`  Skipping (idempotent): ${stmt.substring(0, 80).replace(/\n/g, " ")}...`);
        } else {
          throw err;
        }
      }
    }

    await pool.query(
      "INSERT INTO __drizzle_migrations_applied (filename) VALUES ($1)",
      [file]
    );
  }

  console.log("Schema setup complete.");
  await pool.end();
}

setupDb().catch((e) => {
  console.error("Schema setup failed:", e.message);
  process.exit(0); // Don't block startup
});
