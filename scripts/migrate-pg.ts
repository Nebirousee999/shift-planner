import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL не задан в .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigrationStatements(file: string, content: string) {
  const statements = content.split("--> statement-breakpoint");
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    try {
      await pool.query(trimmed);
    } catch (e: any) {
      const msg = (e.message ?? "").toLowerCase();
      const code = e.code ?? "";

      // Игнорируем «уже существует»
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        code === "42P07" || // duplicate_table
        code === "42701" || // duplicate_column
        code === "42P16" || // invalid_table_definition
        code === "42710"    // duplicate_object
      ) {
        console.log("  ⏭  Skipped (exists):", trimmed.slice(0, 70).replace(/\s+/g, " "), "...");
        continue;
      }

      console.error(`  ❌ Error in ${file}:`, e.message);
      throw e;
    }
  }
}

async function main() {
  console.log("⏳ Применяем миграции к PostgreSQL...");
  const maskedUrl = DATABASE_URL!.replace(/:[^:@]+@/, ":***@");
  console.log(`   DB: ${maskedUrl}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    )
  `);

  const dir = "./db/migrations";
  if (!fs.existsSync(dir)) {
    console.error(`❌ Папка ${dir} не найдена`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  console.log(`   Найдено миграций: ${files.length}`);

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const existing = await pool.query(
      "SELECT name FROM _migrations WHERE name = $1",
      [file]
    );
    if (existing.rows.length > 0) {
      console.log(`  ✔ Already applied: ${file}`);
      skipped++;
      continue;
    }

    console.log(`  🔧 Applying: ${file}`);
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    await runMigrationStatements(file, content);
    await pool.query(
      "INSERT INTO _migrations (name, applied_at) VALUES ($1, $2)",
      [file, Date.now()]
    );
    applied++;
  }

  console.log(`\n✅ Готово. Применено: ${applied}, пропущено: ${skipped}`);
  await pool.end();
}

main().catch(e => {
  console.error("\n❌ Migration failed:", e.message);
  process.exit(1);
});