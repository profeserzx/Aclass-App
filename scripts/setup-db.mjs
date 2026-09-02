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

  // Check if schema already exists (look for the schools table)
  const { rows } = await pool.query(
    "SELECT to_regclass('public.schools') as exists"
  );
  if (rows[0].exists) {
    console.log("Schema already exists — skipping migration.");
    await pool.end();
    return;
  }

  for (const file of sqlFiles) {
    console.log(`Running migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pool.query(stmt);
    }
  }

  console.log("Schema setup complete.");
  await pool.end();
}

setupDb().catch((e) => {
  console.error("Schema setup failed:", e.message);
  process.exit(0); // Don't block startup
});
