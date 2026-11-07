import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "frontend/src/components/OnboardingWidget.tsx");

if (!fs.existsSync(filePath)) {
  console.error("❌ Файл OnboardingWidget.tsx не найден!");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf-8");
const isCRLF = raw.includes("\r\n");
let src = isCRLF ? raw.replace(/\r\n/g, "\n") : raw;
const orig = src;

// Ищем старую подсказку для шага с расписанием и заменяем её
const findStr = `desc: "Перейдите в «Недели» и расставьте смены для сотрудников.",`;
const replaceStr = `desc: "В разделе «Недели» расставьте смены и обязательно нажмите кнопку «Опубликовать».",`;

if (src.includes(findStr)) {
  src = src.replace(findStr, replaceStr);
  console.log("✅ Текст подсказки про расписание обновлен.");
} else {
  // Если форматирование отличается (например, изменились кавычки), ищем по части строки
  if (src.includes("Перейдите в «Недели» и расставьте смены")) {
    // Находим строку целиком с desc и заменяем
    src = src.replace(
      /desc:\s*"Перейдите в «Недели» и расставьте смены[^"]*",/g,
      replaceStr
    );
    console.log("✅ Текст подсказки обновлен (fallback).");
  } else {
    console.log("⚠️ Не нашли старый текст подсказки. Возможно, он уже изменен.");
  }
}

if (src !== orig) {
  fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src, "utf-8");
  console.log("\n🎉 Готово! Файл OnboardingWidget.tsx обновлен.");
} else {
  console.log("\n⚠️ Изменений не внесено.");
}