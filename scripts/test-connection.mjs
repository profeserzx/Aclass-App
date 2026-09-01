import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const result = await sql`select current_database(), now()`;
console.log("Connected OK:", result[0]);
