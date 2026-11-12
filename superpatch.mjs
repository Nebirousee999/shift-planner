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

// 1. Добавляем функцию-парсер для выделения текста в кавычках
const helperFunction = `
// Хелпер для выделения текста в кавычках «...» жирным и цветом
const formatDesc = (text: string) => {
  const parts = text.split(/(«[^»]+»)/g);
  return parts.map((part, i) =>
    part.startsWith("«") && part.endsWith("»") ? (
      <strong key={i} className="text-brand-600 font-bold">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};
`;

if (!content.includes("const formatDesc =")) {
  content = content.replace(
    `export default function OnboardingWidget() {`,
    `${helperFunction}\nexport default function OnboardingWidget() {`
  );
  touched++;
  console.log("✅ Добавлена функция выделения текста.");
}

// 2. Обновляем текст шага "Привяжите сотрудников"
const search1 = `desc: "В разделе «Сотрудники» (Матрица) отметьте, кто в какой локации работает.",`;
const replace1 = `desc: "В разделе «Сотрудники», в блоке «Матрица привязок» нажмите на «Редактировать привязки», отметьте, кто в какой локации работает, «Сохранить».",`;

if (content.includes(search1)) {
  content = content.replace(search1, replace1);
  touched++;
  console.log("✅ Обновлен текст шага 'Привяжите сотрудников'.");
} else if (!content.includes(replace1)) {
  console.log("⚠️ Текст шага 'Привяжите сотрудников' не найден (возможно, уже обновлен).");
}

// 3. Обновляем текст шага "Создайте расписание"
const search2 = `desc: "В разделе «Недели» расставьте смены и обязательно нажмите кнопку «Опубликовать».",`;
const replace2 = `desc: "В разделе «Недели» нажмите на нужную неделю, «Редактировать», расставьте смены, «Готово» и обязательно нажмите кнопку «Опубликовать».",`;

if (content.includes(search2)) {
  content = content.replace(search2, replace2);
  touched++;
  console.log("✅ Обновлен текст шага 'Создайте расписание'.");
} else if (!content.includes(replace2)) {
  console.log("⚠️ Текст шага 'Создайте расписание' не найден (возможно, уже обновлен).");
}

// 4. Применяем функцию выделения при рендере
const searchRender = `<div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {step.desc}
                          </div>`;
const replaceRender = `<div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {formatDesc(step.desc)}
                          </div>`;

if (content.includes(searchRender)) {
  content = content.replace(searchRender, replaceRender);
  touched++;
  console.log("✅ Применено форматирование при рендере.");
} else {
  // Пробуем найти без переносов строк (на случай если форматирование в одну строку)
  const searchRenderInline = `{step.desc}`;
  if (content.includes(searchRenderInline) && !content.includes(`formatDesc(step.desc)`)) {
    content = content.replace(searchRenderInline, `{formatDesc(step.desc)}`);
    touched++;
    console.log("✅ Применено форматирование при рендере (inline).");
  }
}

if (touched > 0) {
  fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("\n🎉 Готово! Тексты обновлены, а все слова в кавычках теперь синие и жирные.");
} else {
  console.log("\n⚠️ Изменений не внесено.");
}