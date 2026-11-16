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

// Ищем конкретную кнопку "Сохранить и скачать"
const buttonRegex = /(<button\s+onClick=\{)(.*?)(\}\s+className="inline-flex items-center gap-2 bg-brand-600[^>]*>\s*<Download className="w-5 h-5" \/>\s*Сохранить и скачать)/s;

if (buttonRegex.test(normalized)) {
  normalized = normalized.replace(buttonRegex, (match, p1, p2, p3) => {
    // Если внутри onClick еще нет trackEvent, добавляем его
    if (!p2.includes("trackEvent")) {
      return `${p1}() => {
          trackEvent("calc_save_click");
          setIsSaving(true);
        }${p3}`;
    }
    return match;
  });
  changed = true;
  console.log("✅ Цель 'calc_save_click' жестко привязана к кнопке 'Сохранить и скачать'");
} else {
  // Запасной вариант, если регулярка не сработала из-за форматирования
  const oldOnClick = `onClick={() => setIsSaving(true)}`;
  const newOnClick = `onClick={() => {
              trackEvent("calc_save_click");
              setIsSaving(true);
            }}`;

  if (normalized.includes(oldOnClick)) {
    normalized = normalized.replace(oldOnClick, newOnClick);
    changed = true;
    console.log("✅ Цель 'calc_save_click' добавлена на кнопку (запасной метод)");
  } else if (normalized.includes('trackEvent("calc_save_click")')) {
    console.log("⏭  Цель 'calc_save_click' уже есть в коде");
  } else {
    console.log("⚠️ Не удалось найти кнопку 'Сохранить и скачать'. Проверь код вручную.");
  }
}

if (changed) {
  fs.writeFileSync(file, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("💾 Файл CalculatorPage.tsx сохранён!");
} else {
  console.log("✨ Изменений не требуется.");
}