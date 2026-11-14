// superpatch.mjs
import fs from "node:fs";

const file = "frontend/src/pages/CalculatorPage.tsx";
if (!fs.existsSync(file)) {
  console.error("❌ Файл не найден:", file);
  process.exit(1);
}

let code = fs.readFileSync(file, "utf-8");
const hadCRLF = code.includes("\r\n");
let normalized = hadCRLF ? code.replace(/\r\n/g, "\n") : code;
let changed = false;

// Ищем кнопку "Сохранить и скачать"
const oldButton = `onClick={() => setIsSaving(true)}`;
const newButton = `onClick={() => {
              setIsSaving(true);
              trackEvent("calc_save_click");
            }}`;

if (normalized.includes(oldButton)) {
  normalized = normalized.replace(oldButton, newButton);
  changed = true;
  console.log("✅ Добавлена цель Метрики 'calc_save_click' на кнопку 'Сохранить и скачать'");
} else {
  console.log("⚠️ Не удалось найти кнопку (возможно, уже обновлена)");
}

if (changed) {
  fs.writeFileSync(file, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("💾 Файл CalculatorPage.tsx сохранён!");
} else {
  console.log("✨ Изменений не требуется.");
}