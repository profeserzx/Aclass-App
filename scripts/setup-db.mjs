import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      try {
        await pool.query(stmt);
      } catch (err) {
        // Idempotency: if a type/table/index already exists from a prior
        // run, skip it instead of aborting the whole migration.
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
