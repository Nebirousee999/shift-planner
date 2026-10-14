import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const pg = new PGlite("./pgdata");
const db = drizzle(pg);

console.log("⏳ Применяем миграции...");
await migrate(db, { migrationsFolder: "./db/migrations" });
console.log("✅ Миграции применены");

await pg.close();