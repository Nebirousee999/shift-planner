// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Если это регулярное выражение — используем replace напрямую
  if (search instanceof RegExp) {
    if (search.test(content)) {
      content = content.replace(search, replace);
      fs.writeFileSync(filePath, content, "utf-8");
      touched++;
      console.log("✅ [" + label + "] Применено (Regex)");
    } else {
      console.log("⏭  [" + label + "] Не найдено (уже удалено)");
    }
    return;
  }

  // Обычная текстовая замена
  if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⏭  [" + label + "] Не найдено (возможно, уже удалено)");
  }
}

// ═══ 1. Исправляем крестик в виджете ═══
patchFile(
  "frontend/src/components/SupportWidget.tsx",
  `<div className="flex gap-2 overflow-x-auto pb-1">`,
  `<div className="flex gap-2 overflow-x-auto pt-3 pb-2 px-1">`,
  "SupportWidget.tsx (отступы для контейнера картинок)"
);

patchFile(
  "frontend/src/components/SupportWidget.tsx",
  `className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"`,
  `className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10"`,
  "SupportWidget.tsx (фикс кнопки крестика)"
);

// ═══ 2. Полностью удаляем синий блок из Справки (HelpPage) ═══
// Используем регулярное выражение, которое ищет комментарий и удаляет всё до тега </main>
patchFile(
  "frontend/src/pages/HelpPage.tsx",
  /\{\/\* Блок поддержки \*\/\}[\s\S]*?<\/main>/,
  `      </main>`,
  "HelpPage.tsx (удаление синего блока)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже применено).");
}