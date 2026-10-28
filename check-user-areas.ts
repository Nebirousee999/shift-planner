import { db } from "./db/client.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const r = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_areas'
      ORDER BY ordinal_position
    `);
    const rows = (r as any).rows ?? [];
    if (rows.length === 0) {
      console.log("❌ Таблица user_areas НЕ существует. Нужны миграции.");
    } else {
      console.log("✅ Таблица user_areas существует:");
      console.table(rows);
    }
  } catch (e) {
    console.error("Ошибка:", e);
  }
  process.exit(0);
}

main();