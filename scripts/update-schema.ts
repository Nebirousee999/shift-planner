
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_password_sent boolean DEFAULT false NOT NULL;`);
console.log("✅ Таблица users обновлена");
