// superpatch.mjs
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

// ─────────────────────────────────────────────────────────
// 1) Шапка календаря: перестраиваем в 2 строки (навигация + статистика на всю ширину)
// ─────────────────────────────────────────────────────────
const headerRegex = /<div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">[\s\S]*?(?=\{viewMode === "month" && \()/;

const newHeader = `<div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex bg-slate-200 p-1 rounded-lg mr-2">
                    <button onClick={() => setViewMode("month")} className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${viewMode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}>Месяц</button>
                    <button onClick={() => setViewMode("year")} className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${viewMode === "year" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}\`}>Год</button>
                  </div>
                  <button onClick={() => {
                    if (viewMode === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
                    else setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1));
                  }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="font-bold text-slate-900 text-lg min-w-[160px] text-center capitalize">
                    {viewMode === "month" ? \`\${MONTHS_RU[currentMonth.getMonth()]} \${currentMonth.getFullYear()}\` : \`\${currentMonth.getFullYear()} год\`}
                  </div>
                  <button onClick={() => {
                    if (viewMode === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
                    else setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1));
                  }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex w-full flex-wrap sm:flex-nowrap justify-between items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Норма</span>
                  <span className="font-bold text-slate-900">{getNorm(currentMonth.getFullYear(), currentMonth.getMonth())} ч.</span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Отработано</span>
                  <span className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalHours : monthStats.hours} ч.</span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Переработка</span>
                  <span className={\`font-bold \${(viewMode === 'year' ? yearData.totalHours - (getNorm(currentMonth.getFullYear(), currentMonth.getMonth()) * 12) : monthStats.hours - getNorm(currentMonth.getFullYear(), currentMonth.getMonth())) > 0 ? "text-rose-600" : "text-emerald-600"}\`}>
                    {viewMode === 'year' ? (yearData.totalHours - (getNorm(currentMonth.getFullYear(), currentMonth.getMonth()) * 12) > 0 ? "+" : "") + (yearData.totalHours - (getNorm(currentMonth.getFullYear(), currentMonth.getMonth()) * 12)) : (monthStats.hours - getNorm(currentMonth.getFullYear(), currentMonth.getMonth()) > 0 ? "+" : "") + (monthStats.hours - getNorm(currentMonth.getFullYear(), currentMonth.getMonth()))} ч.
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">{viewMode === 'year' ? "Смен за год" : "Смен"}</span>
                  <span className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalShifts : monthStats.shifts}</span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">{viewMode === 'year' ? "Часов за год" : "Часов"}</span>
                  <span className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalHours : monthStats.hours}</span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Ночных</span>
                  <span className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalNightShifts : monthStats.nightShifts}</span>
                </div>
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Затраты</span>
                  <span className="font-bold text-emerald-600">{viewMode === 'year' ? yearData.totalCost : monthStats.cost} ₽</span>
                  {viewMode === 'year' && (yearData.totalNightBonus > 0 || yearData.totalHolidayBonus > 0) && (
                    <div className="flex flex-col items-center text-[9px] text-slate-500 mt-0.5">
                      {yearData.totalNightBonus > 0 && <span>(в т.ч. ночные +{yearData.totalNightBonus} ₽)</span>}
                      {yearData.totalHolidayBonus > 0 && <span>(в т.ч. празд. +{yearData.totalHolidayBonus} ₽)</span>}
                    </div>
                  )}
                  {viewMode === 'month' && (monthStats.nightBonus > 0 || monthStats.holidayBonus > 0) && (
                    <div className="flex flex-col items-center text-[9px] text-slate-500 mt-0.5">
                      {monthStats.nightBonus > 0 && <span>(в т.ч. ночные +{monthStats.nightBonus} ₽)</span>}
                      {monthStats.holidayBonus > 0 && <span>(в т.ч. празд. +{monthStats.holidayBonus} ₽)</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            `;

if (headerRegex.test(content)) {
  content = content.replace(headerRegex, newHeader);
  console.log("  [OK] Шапка календаря перестроена: блок статистики теперь на всю ширину.");
} else {
  console.warn("  [WARN] Не удалось найти шапку календаря по регулярному выражению.");
}

// ─────────────────────────────────────────────────────────
// 2) Годовой вид: праздники (рамка + диагональная черта)
// ─────────────────────────────────────────────────────────
const oldYearBlock = `                              <div
                                key={day}
                                title={\`\${day} \${monthName}\${working.length ? \` (\${working.map(w=>w.name).join(", ")})\` : ""}\`}
                                className="relative w-full aspect-square rounded-sm flex flex-col overflow-hidden border border-white/20"
                              >`;
const newYearBlock = `                              <div
                                key={day}
                                title={\`\${day} \${monthName}\${working.length ? \` (\${working.map(w=>w.name).join(", ")})\` : ""}\${getHolidays(currentMonth.getFullYear()).includes(date.toISOString().slice(0, 10)) ? " (Праздник)" : ""}\`}
                                className={\`relative w-full aspect-square rounded-sm flex flex-col overflow-hidden border border-white/20 \${getHolidays(currentMonth.getFullYear()).includes(date.toISOString().slice(0, 10)) ? "ring-2 ring-rose-500 ring-inset z-10" : ""}\`}
                              >
                                {getHolidays(currentMonth.getFullYear()).includes(date.toISOString().slice(0, 10)) && (
                                  <div className="absolute inset-0 pointer-events-none z-[5]" 
                                       style={{ backgroundImage: "linear-gradient(45deg, transparent 48%, rgba(225, 29, 72, 0.8) 49%, rgba(225, 29, 72, 0.8) 51%, transparent 52%)" }} />
                                )}`;

if (content.includes(oldYearBlock)) {
  content = content.split(oldYearBlock).join(newYearBlock);
  console.log("  [OK] Годовая сетка: добавлена штриховка и красная рамка для праздников.");
} else {
  console.warn("  [WARN] Не удалось найти блок годовой сетки. Возможно, он уже пропатчен.");
}

// ─────────────────────────────────────────────────────────
// Сохранение
// ─────────────────────────────────────────────────────────
if (content !== original.replace(/\r\n/g, "\n")) {
  fs.writeFileSync(fullPath, content.replace(/\n/g, eol), "utf8");
  console.log(`\n[SAVE] ${file} — записано`);
} else {
  console.log(`\n[NOOP] без изменений`);
}