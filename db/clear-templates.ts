import { db } from "./client.js";
import { documentCustomTemplates } from "./schema.js";

console.log("⏳ Удаляем все кастомные шаблоны...");

const deleted = await db
  .delete(documentCustomTemplates)
  .returning({ id: documentCustomTemplates.id, type: documentCustomTemplates.type });

console.log(`✅ Удалено: ${deleted.length}`);
for (const row of deleted) {
  console.log(`   - ${row.type} (${row.id})`);
}

process.exit(0);