import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "./pgdata";

// Проверяем: если ссылка начинается с postgres:// или postgresql:// — значит это облако
const isPostgres =
  DATABASE_URL.startsWith("postgres://") ||
  DATABASE_URL.startsWith("postgresql://");

// Используем `any`, чтобы TypeScript не ругался на два разных типа драйверов
export let db: any;
export let pg: any;

if (isPostgres) {
  // ─── ОБЛАКО: Managed PostgreSQL ───
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  db = drizzlePg(pool, { schema });
  pg = pool;

  if (process.env.NODE_ENV !== "test") {
    const result = await pg.query<{ version: string }>("SELECT version();");
    console.log("✅ PostgreSQL готов:", result.rows[0]?.version);
  }
} else {
  // ─── ЛОКАЛЬНО: PGlite ───
  // Динамический импорт, чтобы в облаке не грузить PGlite зря
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite(DATABASE_URL);

  db = drizzlePglite(pglite, { schema });
  pg = pglite;

  if (process.env.NODE_ENV !== "test") {
    const result = await pg.query<{ version: string }>("SELECT version();");
    console.log("✅ PGlite готов:", result.rows[0]?.version);
  }
}