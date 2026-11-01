// superpatch-bigger-text-days.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function readN(p) {
  const raw = fs.readFileSync(path.join(ROOT, p), "utf-8");
  const hadCRLF = raw.includes("\r\n");
  return { content: raw.replace(/\r\n/g, "\n"), hadCRLF };
}
function writeN(p, data) {
  const out = data.hadCRLF ? data.content.replace(/\n/g, "\r\n") : data.content;
  fs.writeFileSync(path.join(ROOT, p), out, "utf-8");
  console.log(`✔ ${p}${data.hadCRLF ? " (CRLF)" : " (LF)"}`);
}

const P = "frontend/src/pages/DashboardPage.tsx";
const data = readN(P);
let c = data.content;
let touched = 0;

// 1. Увеличиваем контейнер с датой и днем недели (было text-[11px])
const targetDateRow = `                  <div className="flex items-center justify-between text-[11px] whitespace-nowrap mb-1">`;
const replaceDateRow = `                  <div className="flex items-center justify-between text-sm sm:text-base whitespace-nowrap mb-1.5">`;

if (c.includes(targetDateRow)) {
  c = c.replace(targetDateRow, replaceDateRow);
  touched++;
} else {
  console.warn("⚠ Не найден контейнер даты (text-[11px]).");
}

// 2. Увеличиваем саму цифру дня (было просто font-bold)
const targetDateNum = `<span className={\`font-bold \${isSelected || isToday ? "text-brand-700" : "text-slate-900"}\`}>`;
const replaceDateNum = `<span className={\`font-bold text-lg sm:text-xl \${isSelected || isToday ? "text-brand-700" : "text-slate-900"}\`}>`;

if (c.includes(targetDateNum)) {
  c = c.replace(targetDateNum, replaceDateNum);
  touched++;
} else {
  console.warn("⚠ Не найдена цифра дня (font-bold).");
}

// 3. Делаем день недели чуть темнее и крупнее
const targetDayName = `<span className="text-slate-400 font-medium">{WEEKDAYS_RU[idx]}</span>`;
const replaceDayName = `<span className="text-slate-500 font-medium ml-1">{WEEKDAYS_RU[idx]}</span>`;

if (c.includes(targetDayName)) {
  c = c.replace(targetDayName, replaceDayName);
  touched++;
} else {
  console.warn("⚠ Не найден день недели (text-slate-400).");
}

// 4. Увеличиваем строку со сменами и стоимостью (было text-[10px])
const targetStatsRow = `                  <div className="text-[10px] text-slate-500 mb-2 font-medium">`;
const replaceStatsRow = `                  <div className="text-xs sm:text-sm text-slate-600 mb-2 font-medium">`;

if (c.includes(targetStatsRow)) {
  c = c.replace(targetStatsRow, replaceStatsRow);
  touched++;
} else {
  console.warn("⚠ Не найдена строка со сменами (text-[10px]).");
}

data.content = c;
writeN(P, data);

console.log(`\n✅ Суперпатч применён. Изменений: ${touched}.`);
console.log("Перезапусти фронтенд (Vite) и проверь.");