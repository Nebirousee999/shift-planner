import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "frontend/src/pages/TeamPage.tsx");

if (!fs.existsSync(filePath)) {
  console.error("❌ TeamPage.tsx не найден");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf-8");
const isCRLF = raw.includes("\r\n");
let src = isCRLF ? raw.replace(/\r\n/g, "\n") : raw;
const orig = src;

// Исправляем ранний return в функции onBulkApply
const findStr = `  const onBulkApply = async () => {
    if (!bulkAction || !bulkValue || selected.size === 0) return;`;

const replaceStr = `  const onBulkApply = async () => {
    if (!bulkAction || (bulkAction !== "delete" && !bulkValue) || selected.size === 0) return;`;

if (src.includes(findStr)) {
  src = src.replace(findStr, replaceStr);
  console.log("✅ Исправлена проверка в onBulkApply (разрешено удаление без значения)");
} else {
  // Если отступы чуть другие, ищем просто нужную строку
  if (src.includes("if (!bulkAction || !bulkValue || selected.size === 0) return;")) {
    src = src.replace("if (!bulkAction || !bulkValue || selected.size === 0) return;", 'if (!bulkAction || (bulkAction !== "delete" && !bulkValue) || selected.size === 0) return;');
    console.log("✅ Исправлена проверка в onBulkApply (fallback)");
  } else {
    console.log("⚠️ Не нашли строку с проверкой onBulkApply.");
  }
}

if (src !== orig) {
  fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src, "utf-8");
  console.log("\n🎉 Готово! Обновите страницу и попробуйте удалить сотрудника снова.");
} else {
  console.log("\n⚠️ Изменений не внесено.");
}