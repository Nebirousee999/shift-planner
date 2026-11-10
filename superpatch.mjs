import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. WeeksPage.tsx (Добавляем красную точку в общий календарь)
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `                        {hasPendingRequest && (\n                          <span\n                            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white z-10"\n                            title="Есть запрос"\n                          />\n                        )}`,
  `                        {hasPendingRequest && (\n                          <span\n                            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white z-10"\n                            title="Есть запрос"\n                          />\n                        )}\n                        {sickLeaves.some(s => String(s.startDate).slice(0, 10) <= dateStr && String(s.endDate).slice(0, 10) >= dateStr) && (\n                          <span\n                            className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white z-10"\n                            title="Есть больничный"\n                          />\n                        )}`,
  "WeeksPage.tsx (индикатор больничного)"
);

// 2. WeekDetailPage.tsx (Добавляем карточку больничного в детальный просмотр)
patchFile(
  "frontend/src/pages/WeekDetailPage.tsx",
  `                {/* Смены */}\n                <div\n                  className={\`\${` +
  `isExpanded ? "flex flex-wrap gap-2 content-start" : "space-y-2"\n                  } flex-1\`}\n                >\n                  {dayShifts.map((s) => {`,
  `                {/* Смены */}\n                <div\n                  className={\`\${` +
  `isExpanded ? "flex flex-wrap gap-2 content-start" : "space-y-2"\n                  } flex-1\`}\n                >\n                  {sickLeaves.filter(s => String(s.startDate).slice(0,10) <= date && String(s.endDate).slice(0,10) >= date).map(s => {\n                    const u = users.find(x => x.id === s.userId);\n                    return (\n                      <div key={s.id} className="rounded-lg border-l-4 border-rose-500 bg-rose-50 text-rose-900 text-xs p-2">\n                        <div className="font-semibold mb-0.5 flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" /> Больничный</div>\n                        <div className="truncate">{u?.name || "Сотрудник"}</div>\n                      </div>\n                    );\n                  })}\n                  {dayShifts.map((s) => {`,
  "WeekDetailPage.tsx (карточка больничного)"
);

// 3. WeekDetailPage.tsx (Добавляем импорт Stethoscope, если его нет)
patchFile(
  "frontend/src/pages/WeekDetailPage.tsx",
  `  Maximize2, Minimize2, Bell, Wallet, CalendarX2,\n} from "lucide-react";`,
  `  Maximize2, Minimize2, Bell, Wallet, CalendarX2, Stethoscope,\n} from "lucide-react";`,
  "WeekDetailPage.tsx (импорт Stethoscope)"
);

// 4. MySchedulePage.tsx (Показываем больничный сотруднику)
patchFile(
  "frontend/src/pages/MySchedulePage.tsx",
  `                            {!hasAnything && <div className="text-xs text-slate-300 text-center py-3">—</div>}\n                            \n                            {dayShifts.map((s) => {`,
  `                            {!hasAnything && <div className="text-xs text-slate-300 text-center py-3">—</div>}\n                            \n                            {mySickLeaves.filter(sl => String(sl.startDate).slice(0,10) <= date && String(sl.endDate).slice(0,10) >= date).map(sl => (\n                              <div key={sl.id} className="text-xs p-2 rounded-lg border-l-4 border-rose-500 bg-rose-50 text-rose-900 mb-2">\n                                <div className="flex items-center gap-1.5 font-medium">\n                                  <Stethoscope className="w-3 h-3 text-rose-600 shrink-0" />\n                                  Больничный\n                                </div>\n                                {sl.comment && <div className="text-[10px] text-rose-700/80 mt-0.5 truncate">{sl.comment}</div>}\n                              </div>\n                            ))}\n\n                            {dayShifts.map((s) => {`,
  "MySchedulePage.tsx (карточка больничного для сотрудника)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}