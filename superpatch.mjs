// superpatch.mjs
import fs from "node:fs";

const file = "frontend/src/pages/WeeksPage.tsx";
if (!fs.existsSync(file)) {
  console.error("❌ Файл не найден:", file);
  process.exit(1);
}

let code = fs.readFileSync(file, "utf-8");
const hadCRLF = code.includes("\r\n");
let normalized = hadCRLF ? code.replace(/\r\n/g, "\n") : code;
let changed = false;

// 1. Увеличиваем высоту линий и уменьшаем зазор между ними в 2 раза
// Меняем отступы в ShiftLines
const oldLinesStyle = `top: \`calc(\${topPct}% + 2px)\`,\n              height: \`calc(\${laneHeightPct}% - 4px)\`,`;
const newLinesStyle = `top: \`calc(\${topPct}% + 0.5px)\`,\n              height: \`calc(\${laneHeightPct}% - 1px)\`,`;

if (normalized.includes(oldLinesStyle)) {
  normalized = normalized.replace(oldLinesStyle, newLinesStyle);
  changed = true;
  console.log("✅ Полоски смен стали выше, зазор уменьшен");
} else {
  // Запасной вариант поиска
  const linesRegex = /top:\s*`calc\(\$\{topPct\}%\s*\+\s*2px\)`,\s*height:\s*`calc\(\$\{laneHeightPct\}%\s*-\s*4px\)`/g;
  if (linesRegex.test(normalized)) {
    normalized = normalized.replace(linesRegex, "top: `calc(${topPct}% + 0.5px)`, height: `calc(${laneHeightPct}% - 1px)`");
    changed = true;
    console.log("✅ Полоски смен стали выше, зазор уменьшен (regex)");
  } else {
    console.log("⚠️ Не удалось найти стили полосок");
  }
}

// 2. Двигаем дату влево-вверх и делаем её чуть более компактной
const oldDateBlock = `<div className="flex items-center justify-center">
                          <div
                            className={\`text-base font-semibold \${
                              isToday
                                ? "w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm shadow-sm"
                                : isOtherMonth
                                ? "text-slate-300"
                                : isWeekend
                                ? "text-slate-400"
                                : "text-slate-900"
                            }\`}
                          >
                            {d.getUTCDate()}
                          </div>
                        </div>`;

const newDateBlock = `<div className="flex items-start justify-start pl-1 pt-0.5 relative z-10">
                          <div
                            className={\`text-sm font-semibold leading-none \${
                              isToday
                                ? "w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs shadow-sm"
                                : isOtherMonth
                                ? "text-slate-300"
                                : isWeekend
                                ? "text-slate-400"
                                : "text-slate-900"
                            }\`}
                          >
                            {d.getUTCDate()}
                          </div>
                        </div>`;

if (normalized.includes(oldDateBlock)) {
  normalized = normalized.replace(oldDateBlock, newDateBlock);
  changed = true;
  console.log("✅ Дата сдвинута влево и вверх");
} else {
  console.log("⚠️ Не удалось найти блок с датой (возможно, уже изменен)");
}

// 3. Чуть уменьшаем верхние/нижние отступы у самой ячейки дня, чтобы дате и линиям было просторнее
const oldCellPad = `className={\`relative pt-2 px-1.5 pb-2 flex flex-col border-r border-slate-100 last:border-0 min-h-[85px] \${
                          isToday ? "bg-blue-100/60" : isWeekend ? "bg-slate-50/40" : ""
                        }\`}`;
const newCellPad = `className={\`relative pt-1 px-1 pb-1 flex flex-col border-r border-slate-100 last:border-0 min-h-[85px] \${
                          isToday ? "bg-blue-100/60" : isWeekend ? "bg-slate-50/40" : ""
                        }\`}`;

if (normalized.includes(oldCellPad)) {
  normalized = normalized.replace(oldCellPad, newCellPad);
  changed = true;
  console.log("✅ Отступы внутри ячейки дня уменьшены");
} else {
  const padRegex = /relative pt-2 px-1\.5 pb-2 flex flex-col/g;
  if (padRegex.test(normalized)) {
    normalized = normalized.replace(padRegex, "relative pt-1 px-1 pb-1 flex flex-col");
    changed = true;
    console.log("✅ Отступы внутри ячейки дня уменьшены (regex)");
  }
}

if (changed) {
  fs.writeFileSync(file, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("💾 Файл WeeksPage.tsx сохранён!");
} else {
  console.log("✨ Изменений не требуется или патч не применился.");
}