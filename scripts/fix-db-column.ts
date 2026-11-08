
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
try {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_password_sent boolean DEFAULT false NOT NULL;`);
  console.log("✅ БД: Колонка is_temp_password_sent подтверждена.");
} catch (e) {
  console.error("Ошибка БД:", e);
}
process.exit(0);
