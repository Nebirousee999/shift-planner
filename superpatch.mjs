// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "frontend/src/components/OnboardingWidget.tsx");

if (!fs.existsSync(FILE)) {
  console.error("❌ Файл OnboardingWidget.tsx не найден");
  process.exit(1);
}

let content = fs.readFileSync(FILE, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

let touched = 0;

// 1. Обновляем текст для шага "Привяжите сотрудников"
const search1 = `desc: "В разделе «Сотрудники» (Матрица) отметьте, кто в какой локации работает.",`;
const replace1 = `desc: "В разделе «Сотрудники», в блоке «Матрица привязок» нажмите на «Редактировать привязки» и отметьте, кто в какой локации работает.",`;

if (content.includes(replace1)) {
  console.log("⏭  [Привязка сотрудников] уже обновлено.");
} else if (content.includes(search1)) {
  content = content.replace(search1, replace1);
  touched++;
  console.log("✅ [Привязка сотрудников] текст обновлен.");
} else {
  console.log("❌ Не удалось найти текст шага «Привяжите сотрудников».");
}

// 2. Обновляем текст для шага "Создайте расписание"
const search2 = `desc: "В разделе «Недели» расставьте смены и обязательно нажмите кнопку «Опубликовать».",`;
const replace2 = `desc: "В разделе «Недели» нажмите на нужную неделю, расставьте смены и обязательно нажмите кнопку «Опубликовать».",`;

if (content.includes(replace2)) {
  console.log("⏭  [Создайте расписание] уже обновлено.");
} else if (content.includes(search2)) {
  content = content.replace(search2, replace2);
  touched++;
  console.log("✅ [Создайте расписание] текст обновлен.");
} else {
  console.log("❌ Не удалось найти текст шага «Создайте расписание».");
}

if (touched > 0) {
  fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("\n🎉 Готово! Тексты подсказок обновлены.");
} else {
  console.log("\n⚠️ Изменений не внесено (возможно, текст уже правильный).");
}