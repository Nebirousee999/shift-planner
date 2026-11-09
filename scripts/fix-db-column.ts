
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
try {
  await db.execute(sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_bot_token varchar(255);`);
  console.log("✅ Колонка max_bot_token добавлена в organizations!");
} catch (e) {
  console.error("Ошибка БД:", e);
}
process.exit(0);
