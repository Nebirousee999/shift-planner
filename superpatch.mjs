import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "frontend/src/components/landing/demos/WeekDemo.tsx");

if (!fs.existsSync(filePath)) {
  console.error("❌ Файл WeekDemo.tsx не найден!");
  process.exit(1);
}

let src = fs.readFileSync(filePath, "utf-8");
const isCRLF = src.includes("\r\n");
if (isCRLF) src = src.replace(/\r\n/g, "\n");

let touched = 0;

// 1. Меняем контейнер с grid на flex для мобилок
const containerFind = `<div className="grid grid-cols-7 gap-2 sm:gap-3 min-w-[720px] px-1">`;
const containerRepl = `<div className="flex sm:grid sm:grid-cols-7 gap-2 sm:gap-3 px-1 w-max sm:w-auto sm:min-w-0 snap-x snap-mandatory">`;

if (src.includes(containerFind)) {
  src = src.replace(containerFind, containerRepl);
  touched++;
  console.log("✅ Контейнер дней переведен на flex-ленту.");
} else {
  console.log("⚠️ Не нашли главный контейнер сетки.");
}

// 2. Задаем карточкам дня ширину ровно в половину экрана на мобилках
const cardFind = "className={`rounded-xl border-2 min-h-[340px] p-2.5 flex flex-col min-w-0 transition-all ${";
const cardRepl = "className={`w-[calc(50vw_-_1rem)] min-w-[140px] sm:min-w-0 sm:w-auto shrink-0 snap-start rounded-xl border-2 min-h-[340px] p-2.5 flex flex-col transition-all ${";

if (src.includes(cardFind)) {
  src = src.replace(cardFind, cardRepl);
  touched++;
  console.log("✅ Карточкам задана ширина 50vw.");
} else {
  console.log("⚠️ Не нашли карточку дня.");
}

// 3. Фиксим перенос времени смены
const timeFind = `<div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                                {s.startTime}–{s.endTime}
                              </span>`;
const timeRepl = `<div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 truncate">
                                {s.startTime}–{s.endTime}
                              </span>`;

if (src.includes(timeFind)) {
  src = src.replace(timeFind, timeRepl);
  touched++;
  console.log("✅ Время защищено от переноса.");
}

// 4. Фиксим перенос цены
const priceFind = `<div className="text-slate-800 font-bold text-[10px] sm:text-[11px] mt-1">
                              {shiftCost} ₽
                            </div>`;
const priceRepl = `<div className="text-slate-800 font-bold text-[10px] sm:text-[11px] mt-1 truncate">
                              {shiftCost} ₽
                            </div>`;

if (src.includes(priceFind)) {
  src = src.replace(priceFind, priceRepl);
  touched++;
  console.log("✅ Цена защищена от переноса.");
}

if (touched > 0) {
  fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src, "utf-8");
  console.log("\n🎉 Готово! Обновите страницу (Ctrl+Shift+R) в режиме мобильного телефона.");
} else {
  console.log("\n⚠️ Изменений не внесено (возможно, патч уже применен или структура файла отличается).");
}