import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "color" varchar(7) DEFAULT '#3B82F6' NOT NULL;`);
console.log("✅ Колонка color добавлена (или уже существует) в users");
process.exit(0);
