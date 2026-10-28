import { db } from "./db/client.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔍 Ищем дубли локаций...\n");

  const dupes = await db.execute(sql`
    SELECT location_id, LOWER(TRIM(name)) AS norm, COUNT(*) AS cnt
    FROM areas
    GROUP BY location_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);

  const dupeGroups = (dupes as any).rows ?? [];
  if (dupeGroups.length === 0) {
    console.log("✅ Дублей нет. Всё чисто.");
    process.exit(0);
  }

  console.log(`⚠️  Найдено ${dupeGroups.length} групп дублей:`);
  console.table(dupeGroups);

  console.log("\n🔄 Выполняем транзакцию...\n");

  await db.transaction(async (tx) => {
    // 1. Перенос связей user_areas с дублей на «оригинал»
    await tx.execute(sql`
      WITH ranked AS (
        SELECT id, location_id, LOWER(TRIM(name)) AS norm,
               ROW_NUMBER() OVER (
                 PARTITION BY location_id, LOWER(TRIM(name))
                 ORDER BY created_at
               ) AS rn
        FROM areas
      ),
      dupes AS (SELECT id FROM ranked WHERE rn > 1),
      keepers AS (
        SELECT r.location_id, r.norm, r2.id AS keep_id
        FROM ranked r
        JOIN ranked r2
          ON r2.location_id = r.location_id
         AND r2.norm = r.norm
         AND r2.rn = 1
        WHERE r.rn > 1
      )
      INSERT INTO user_areas (user_id, area_id)
      SELECT ua.user_id, k.keep_id
      FROM user_areas ua
      JOIN dupes d ON d.id = ua.area_id
      JOIN ranked r ON r.id = d.id
      JOIN keepers k ON k.location_id = r.location_id AND k.norm = r.norm
      ON CONFLICT DO NOTHING
    `);

    // 2. Удаление дублей
    await tx.execute(sql`
      WITH ranked AS (
        SELECT id, location_id, LOWER(TRIM(name)) AS norm,
               ROW_NUMBER() OVER (
                 PARTITION BY location_id, LOWER(TRIM(name))
                 ORDER BY created_at
               ) AS rn
        FROM areas
      ),
      dupes AS (SELECT id FROM ranked WHERE rn > 1)
      DELETE FROM areas WHERE id IN (SELECT id FROM dupes)
    `);
  });

  console.log("✅ Готово: связи перенесены, дубли удалены.");

  const check = await db.execute(sql`
    SELECT location_id, LOWER(TRIM(name)) AS norm, COUNT(*) AS cnt
    FROM areas
    GROUP BY location_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);
  const remaining = (check as any).rows ?? [];
  console.log(`📊 Дублей осталось: ${remaining.length}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});