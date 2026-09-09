import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  // Check if demo school already exists
  const existing = await pool.query("SELECT id FROM schools WHERE slug = $1", ["demo-school"]);
  if (existing.rows.length > 0) {
    console.log("Seed: demo school already exists, skipping.");
    await pool.end();
    return;
  }

  const school = await pool.query(
    "INSERT INTO schools (name, slug, plan) VALUES ($1, $2, 'starter') RETURNING id",
    ["Demo School", "demo-school"]
  );
  const schoolId = school.rows[0].id;

  const passwordHash = await bcrypt.hash("demo1234", 10);
  await pool.query(
    "INSERT INTO users (school_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')",
    [schoolId, "Demo Admin", "admin@demo.ac.ke", passwordHash]
  );

  console.log("Seed complete! Login with admin@demo.ac.ke / demo1234");
  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(0); // Don't block startup if seed fails
});
