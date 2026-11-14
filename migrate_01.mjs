// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const migrateContent = `import fs from "node:fs";
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
    const statements = content.split("--> statement-breakpoint");
    
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      
      try {
        await db.execute(sql.raw(trimmed));
      } catch (e: any) {
        const msg = (e.message ?? "").toLowerCase();
        const code = e.code ?? "";
        
        // Игнорируем ошибки, если колонка/таблица уже существует
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate") ||
          code === "42P07" || // duplicate_table
          code === "42701" || // duplicate_column
          code === "42P16" ||
          code === "42710"
        ) {
          console.log("  ⏭  Skipped (exists):", trimmed.slice(0, 50).replace(/\\s+/g, " "), "...");
          continue;
        }
        
        console.error("  ❌ Ошибка в", file, ":", e.message);
        throw e;
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
`;

fs.writeFileSync(path.join(ROOT, "db/migrate.ts"), migrateContent, "utf-8");
console.log("✅ Файл db/migrate.ts успешно обновлен! Он теперь умеет пропускать существующие колонки.");