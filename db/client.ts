import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

// Локальная база в папке ./pgdata (создастся автоматически)
export const pg = new PGlite("./pgdata");

// Обёртка Drizzle
export const db = drizzle(pg, { schema });

// Быстрая проверка при старте
if (process.env.NODE_ENV !== "test") {
    const result = await pg.query<{ version: string }>("SELECT version();");
    console.log("✅ PGlite готов:", result.rows[0]?.version);
}