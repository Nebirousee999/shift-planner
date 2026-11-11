// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "frontend/src/pages/WeekDetailPage.tsx");

if (!fs.existsSync(FILE)) {
  console.error("❌ Файл WeekDetailPage.tsx не найден");
  process.exit(1);
}

let content = fs.readFileSync(FILE, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

const lines = content.split("\n");
let found = false;

for (let i = 0; i < lines.length; i++) {
  // Ищем строку, где есть и "pendingOut" и "Ожидает согласования"
  if (lines[i].includes("pendingOut") && lines[i].includes("Ожидает согласования")) {
    lines[i] = `                                  {pendingOut && !pendingInc && (
                                    <div className="mt-1.5 flex flex-col gap-1">
                                      <div className="flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-1 leading-tight">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        <span>Ожидает согласования</span>
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onCancelShiftChange(pendingOut.id); }}
                                        disabled={moderating === pendingOut.id}
                                        className="w-full bg-white border border-rose-200 text-rose-600 text-[10px] py-1 rounded hover:bg-rose-50 font-medium transition-colors disabled:opacity-50"
                                      >
                                        Отменить
                                      </button>
                                    </div>
                                  )}`;
    found = true;
    break; // Нашли — выходим из цикла
  }
}

if (found) {
  content = lines.join("\n");
  fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("✅ [WeekDetailPage.tsx] Кнопка отмены для UPDATE смен успешно добавлена!");
} else {
  console.error("❌ Не удалось найти строку с 'pendingOut'. Проверь файл вручную.");
}