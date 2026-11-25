// superpatch.mjs
// Исправление: SyntaxError на строке 365 в CalculatorPage.tsx.
// Восстанавливаем String() вокруг nightRate и holidayRate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = "frontend/src/pages/CalculatorPage.tsx";
const fullPath = path.join(__dirname, file);

if (!fs.existsSync(fullPath)) {
  console.error(`[FATAL] файл не найден: ${file}`);
  process.exit(1);
}

let content = fs.readFileSync(fullPath, "utf8");
const original = content;
const eol = content.includes("\r\n") ? "\r\n" : "\n";
content = content.replace(/\r\n/g, "\n");

// 1. Ищем сломанную строку и чиним её.
// Сломанный вид: nightRate: String(e.nightRate ?? 20, holidayRate: e.holidayRate ?? 2)
const brokenRegex = /nightRate:\s*String\(e\.nightRate\s*\?\?\s*20,\s*holidayRate:\s*e\.holidayRate\s*\?\?\s*2\)/g;
const correctStr = "nightRate: String(e.nightRate ?? 20), holidayRate: String(e.holidayRate ?? 2)";

if (brokenRegex.test(content)) {
  content = content.replace(brokenRegex, correctStr);
  console.log("  [OK] Исправлена сломанная строка String()");
} else {
  // На всякий случай, если там что-то чуть другое — ищем похожий паттерн
  const fallbackRegex = /String\(e\.nightRate\s*\?\?\s*20,\s*holidayRate:\s*e\.holidayRate\s*\?\?\s*2\)/g;
  if (fallbackRegex.test(content)) {
    content = content.replace(fallbackRegex, "String(e.nightRate ?? 20), holidayRate: String(e.holidayRate ?? 2)");
    console.log("  [OK] Исправлено через fallback");
  } else {
    console.log("  [NOOP] Сломанная строка не найдена (возможно, уже исправлена)");
  }
}

// 2. Проверяем, что весь файл теперь парсится нормально (баланс скобок в этой строке)
const line365 = content.split("\n")[364];
if (line365 && line365.includes("holidayRate: String(e.holidayRate ?? 2)")) {
  console.log("  ✓ Строка 365 выглядит корректно");
}

if (content !== original.replace(/\r\n/g, "\n")) {
  fs.writeFileSync(fullPath, content.replace(/\n/g, eol), "utf8");
  console.log(`\n[SAVE] ${file} — исправлено`);
} else {
  console.log(`\n[NOOP] изменений нет`);
}