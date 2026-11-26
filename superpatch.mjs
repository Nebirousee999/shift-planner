// superpatch.mjs
// Финальный фикс дашборда и виджетов (убираем NaN и пустые недели)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(relPath, patcher) {
  const full = path.join(__dirname, relPath);
  if (!fs.existsSync(full)) { console.log(`[SKIP] ${relPath} не найден`); return; }
  const original = fs.readFileSync(full, "utf8");
  const isCRLF = original.includes("\r\n");
  let content = isCRLF ? original.replace(/\r\n/g, "\n") : original;
  let result;
  try { result = patcher(content); }
  catch (e) { console.log(`[ERROR] ${relPath}: ${e.message}`); return; }
  if (result !== content) {
    fs.writeFileSync(full, isCRLF ? result.replace(/\n/g, "\r\n") : result, "utf8");
    console.log(`[SAVE] ${relPath}`);
  } else {
    console.log(`[NOOP] ${relPath}`);
  }
}

patchFile("frontend/src/api/guestAdapter.ts", (out) => {
  // 1. Расширяем перехват счетчиков (чтобы unread-count тоже сюда попадал)
  out = out.replace(
    'if (url.includes("/count") && method === "get") {',
    'if (url.includes("count") && method === "get") {'
  );
  console.log("  [PATCH] guestAdapter: перехват всех count-запросов (фикс NaN)");

  // 2. Полностью заменяем блок /dashboard на пуленепробиваемый
  const oldDashboardRegex = /if \(url\.includes\("\/dashboard"\) && method === "get"\) \{[\s\S]*?data = \{[\s\S]*?\};\n    \}/;
  
  const newDashboard = `if (url.includes("/dashboard") && method === "get") {
      const todayStr = new Date().toISOString().slice(0, 10);
      // Берем недели из базы, если там пусто — берем прямо из сида
      const weeks = (db.weeks && db.weeks.length > 0) ? db.weeks : GUEST_SEED.weeks;
      
      // Ищем текущую неделю по датам
      let currentWeek = weeks.find((w: any) => {
        if (!w.weekStartDate) return false;
        const start = new Date(w.weekStartDate + "T00:00:00Z");
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        return todayStr >= w.weekStartDate && todayStr <= end.toISOString().slice(0, 10);
      });
      
      // Если не нашли — берем 7-ю неделю (она 100% текущая по сиду)
      if (!currentWeek) {
        currentWeek = weeks[6] || weeks[0] || null;
      }

      const todayShifts = currentWeek ? (currentWeek.shifts || []).filter((s: any) => s.shiftDate === todayStr) : [];

      data = {
        currentWeek: currentWeek || null,
        weekTimeEntries: [],
        users: db.users || GUEST_SEED.employees,
        userCount: (db.users || GUEST_SEED.employees).length,
        todayShifts: todayShifts,
        monthlyHours: 0,
      };
    }`;

  if (oldDashboardRegex.test(out)) {
    out = out.replace(oldDashboardRegex, newDashboard);
    console.log("  [PATCH] guestAdapter: блок /dashboard заменен на надежный");
  } else {
    console.log("  [WARN] guestAdapter: не удалось найти старый блок /dashboard");
  }

  return out;
});

console.log("\n✅ Готово. Перезапустите Vite (Ctrl+C → npm run dev) и обновите страницу.");