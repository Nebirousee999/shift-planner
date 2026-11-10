// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) return;

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⚠️ [" + label + "] Не найдено (возможно, уже изменено).");
  }
}

// 1. Патчим support.routes.ts, чтобы передавать message в тикет (обход старого NOT NULL)
patchFile(
  "src/modules/support/support.routes.ts",
  `        .values({\n          userId,\n          email: parsed.data.email,\n          sessionToken,\n          status: "OPEN",\n        })`,
  `        .values({\n          userId,\n          email: parsed.data.email,\n          sessionToken,\n          status: "OPEN",\n          message: parsed.data.message, // Передаем первое сообщение в старое поле для совместимости\n        })`,
  "support.routes.ts (передача message в тикет)"
);

// 2. Создаем миграцию на снятие NOT NULL (если ее нет)
const migrationPath = path.join(ROOT, "db/migrations/0026_fix_support_tickets.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `
ALTER TABLE "support_tickets" ALTER COLUMN "message" DROP NOT NULL;
ALTER TABLE "support_tickets" ALTER COLUMN "images" DROP NOT NULL;
  `);
  touched++;
  console.log("✅ [0026_fix_support_tickets.sql] Создана миграция");
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}