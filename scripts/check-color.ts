import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

const cols = await db.execute(sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'color'
`);
console.log("COLUMN:", cols.rows);

const rows = await db.execute(sql`
  SELECT email, color FROM users LIMIT 5
`);
console.log("USERS:", rows.rows);

const counts = await db.execute(sql`
  SELECT COUNT(*)::int AS total,
         COUNT(color)::int AS non_null
  FROM users
`);
console.log("COUNTS:", counts.rows);

process.exit(0);