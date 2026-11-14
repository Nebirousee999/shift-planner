import fs from "node:fs";
import path from "node:path";
import { db } from "./client.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("⏳ Применяем миграции к PGlite...");
  const dir = "./db/migrations";
  
  if (!fs.existsSync(dir)) {
    console.error("❌ Папка db/migrations не найдена");
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  console.log("   Найдено миграций:", files.length);

  for (const file of files) {
    console.log("  🔧 Применяем:", file);
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    
    // Разделяем по стандартному брейкпоинту Drizzle
    const blocks = content.split("--> statement-breakpoint");
    
    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;

      // Дополнительно разбиваем на отдельные запросы по точке с запятой
      // (это спасает, если в файле забыли брейкпоинты)
      const queries = trimmedBlock.split(/;\s*(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/);
      
      for (const query of queries) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) continue;

        try {
          await db.execute(sql.raw(trimmedQuery));
        } catch (e: any) {
          const pgCode = e.cause?.code || e.code || "";
          const pgMsg = (e.cause?.message || e.message || "").toLowerCase();
          
          // Игнорируем ошибки, если объект уже существует
          if (
            pgMsg.includes("already exists") ||
            pgMsg.includes("duplicate") ||
            pgCode === "42P07" || // duplicate_table
            pgCode === "42701" || // duplicate_column
            pgCode === "42P16" || // invalid_table_definition
            pgCode === "42710"    // duplicate_object (ENUM)
          ) {
            console.log("  ⏭  Skipped (exists):", trimmedQuery.slice(0, 50).replace(/\s+/g, " "), "...");
            continue;
          }
          
          console.error(`  ❌ Ошибка в ${file} :`, e.cause?.message || e.message);
          console.log("  Проблемный SQL:", trimmedQuery);
          throw e;
        }
      }
    }
  }
  console.log("✅ Все миграции успешно применены!");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});