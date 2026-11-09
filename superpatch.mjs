import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const schemaPath = path.join(ROOT, "db/schema.ts");

if (!fs.existsSync(schemaPath)) {
  console.log("❌ Файл db/schema.ts не найден!");
  process.exit(1);
}

let content = fs.readFileSync(schemaPath, "utf-8");
const hadCRLF = content.includes("\r\n");
let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

// 1. Проверяем, импортирован ли jsonb
if (!normalized.includes("jsonb")) {
  normalized = normalized.replace(
    /(import \{[\s\S]*?)(\} from "drizzle-orm\/pg-core";)/,
    (match, p1, p2) => p1.includes("jsonb") ? match : p1 + ", jsonb" + p2
  );
}

// 2. Полностью удаляем notificationSettings из любых мест (чистим за предыдущим патчем)
normalized = normalized.replace(/\s*notificationSettings: jsonb\("notification_settings"\)\.default\(\{\}\)\.notNull\(\),?/g, "");

// 3. Вставляем поле в таблицу users перед закрывающей скобкой
// Ищем "export const users = pgTable("users", {" и вставляем перед первым "});"
const usersTableRegex = /(export const users = pgTable\("users", \{[\s\S]*?)(\}\);)/;
if (usersTableRegex.test(normalized)) {
  normalized = normalized.replace(usersTableRegex, (match, p1, p2) => {
    return `${p1}\n  notificationSettings: jsonb("notification_settings").default({}).notNull(),\n${p2}`;
  });
  console.log("✅ [db/schema.ts] notificationSettings успешно добавлено в таблицу users.");
} else {
  console.log("❌ [db/schema.ts] Не удалось найти определение таблицы users.");
}

const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
fs.writeFileSync(schemaPath, finalContent, "utf-8");