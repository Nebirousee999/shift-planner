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

// ═══ 1. Исправляем 500-ю ошибку на бэкенде (добавляем импорт crypto) ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `import { mailerService } from "../../lib/mailer.service.js";\nimport axios from "axios";`,
  `import { mailerService } from "../../lib/mailer.service.js";\nimport axios from "axios";\nimport crypto from "node:crypto";`,
  "support.routes.ts (импорт crypto)"
);

// ═══ 2. Увеличиваем поле ввода в чате (в 3 раза) ═══
// Меняем количество строк
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `rows={1}`,
  `rows={3}`,
  "SupportChat.tsx (rows=3)"
);

// Меняем CSS-классы, чтобы поле не сжималось и не обрезалось
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `className="flex-1 !text-sm !py-2 !bg-slate-50 !border-slate-200 resize-none max-h-24"`,
  `className="flex-1 !text-sm !py-2 !bg-slate-50 !border-slate-200 resize-none min-h-[72px] max-h-32"`,
  "SupportChat.tsx (высота поля)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}