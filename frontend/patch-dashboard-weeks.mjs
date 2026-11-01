// patch-dashboard-weeks.mjs
// Правильная навигация по "Посмотреть в расписании" (отгулы, обмены, изменения смен)
// Запуск:  node patch-dashboard-weeks.mjs [--dry-run]

import fs from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

const FILE = [
  "src/pages/DashboardPage.tsx",
  "pages/DashboardPage.tsx",
].find((p) => fs.existsSync(p));

if (!FILE) {
  console.error("❌ DashboardPage.tsx не найден");
  process.exit(1);
}
console.log(`📄 ${FILE}`);
if (DRY_RUN) console.log("🔍 dry-run — ничего не сохраняю\n");
else console.log("");

const rawSrc = fs.readFileSync(FILE, "utf8");
const isCRLF = rawSrc.includes("\r\n");
let src = isCRLF ? rawSrc.replace(/\r\n/g, "\n") : rawSrc;
const origNormalized = src;

// ═══════════════════════════════════════════════════════
// Ядро
// ═══════════════════════════════════════════════════════
let applied = 0, skipped = 0, failed = 0;
const failures = [];

function diagnostics(lines, findLines) {
  const longest = findLines.reduce((a, b) => (a.length > b.length ? a : b), "");
  const near = lines.findIndex((l) => l.includes(longest.slice(0, 40)));
  if (near === -1) return `\n   Уникальная строка "${longest.slice(0, 60)}" не найдена.`;
  let out = `\n   Похожее место (строка ${near + 1}):\n`;
  for (let k = Math.max(0, near - 1); k <= Math.min(lines.length - 1, near + 5); k++) {
    out += `   ${k === near ? "→" : " "} ${k + 1}: ${lines[k]}\n`;
  }
  return out;
}

function reindent(originalLine, tplLine, firstIndentLen) {
  const content = tplLine.trimStart();
  if (content === "") return "";
  const baseIndent = originalLine.match(/^\s*/)[0];
  const relIndent = tplLine.length - content.length - firstIndentLen;
  return baseIndent + " ".repeat(Math.max(0, relIndent)) + content;
}

function applyPatch(p) {
  if (p.marker && src.includes(p.marker)) {
    console.log(`⏭  [${p.label}] уже пропатчено`);
    skipped++;
    return;
  }

  const lines = src.split("\n");
  const findLines = p.find
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const matches = [];
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    let ok = true;
    for (let j = 0; j < findLines.length; j++) {
      if (lines[i + j].trim() !== findLines[j]) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(i);
  }

  if (matches.length === 0) {
    console.error(`❌ [${p.label}] не найдено` + diagnostics(lines, findLines));
    failures.push(p.label);
    failed++;
    return;
  }
  if (matches.length > 1) {
    console.warn(`   ⚠️  [${p.label}] ${matches.length} совпадений, беру первое (строка ${matches[0] + 1})`);
  }

  const start = matches[0];
  const replLines = p.repl.split("\n");
  const firstIndentLen = replLines[0].match(/^\s*/)[0].length;
  const prepared = replLines.map((line) => reindent(lines[start], line, firstIndentLen));

  src = [
    ...lines.slice(0, start),
    ...prepared,
    ...lines.slice(start + findLines.length),
  ].join("\n");
  console.log(`✅ [${p.label}] строка ${start + 1}: ${findLines.length} → ${prepared.length} строк`);
  applied++;
}

// ═══════════════════════════════════════════════════════
// ПАТЧ 1 — расширенный findWeekIdByShiftId (учитывает дату)
// ═══════════════════════════════════════════════════════
applyPatch({
  label: "1. findWeekIdByShiftId — поиск по дате в weeks",
  marker: `dateStr?: string | null`,
  find: `const findWeekIdByShiftId = (shiftId: string | null | undefined): string | null => {
           if (!shiftId) return data?.currentWeek?.id ?? null;
           const found = data?.currentWeek?.shifts?.find((s: any) => s.id === shiftId);
           return (found as any)?.weekId ?? data?.currentWeek?.id ?? null;
         };`,
  repl: `const findWeekIdByShiftId = (
           shiftId: string | null | undefined,
           dateStr?: string | null
         ): string | null => {
           // 1. Смена в текущей неделе — быстрый путь
           if (shiftId) {
             const found = data?.currentWeek?.shifts?.find((s: any) => s.id === shiftId);
             if (found) return (found as any).weekId ?? data?.currentWeek?.id ?? null;
           }
           // 2. Ищем неделю, в диапазон которой попадает дата
           if (dateStr) {
             const d = String(dateStr).slice(0, 10);
             for (const w of weeks) {
               const start = String(w.weekStartDate).slice(0, 10);
               if (!start) continue;
               const startDate = new Date(start + "T00:00:00Z");
               const endDate = new Date(startDate);
               endDate.setUTCDate(endDate.getUTCDate() + 7);
               if (d >= start && d < endDate.toISOString().slice(0, 10)) return w.id;
             }
             // Дата задана, но неделя не найдена — идём в список недель
             return null;
           }
           // 3. Ничего не передано — текущая неделя
           return data?.currentWeek?.id ?? null;
         };`,
});

// ═══════════════════════════════════════════════════════
// ПАТЧ 2 — time off: передаём t.date
// ═══════════════════════════════════════════════════════
applyPatch({
  label: "2. Отгул → передаём t.date",
  marker: `findWeekIdByShiftId(t.shiftId, t.date)`,
  find: `const targetWeekId = findWeekIdByShiftId(t.shiftId);`,
  repl: `const targetWeekId = findWeekIdByShiftId(t.shiftId, t.date);`,
});

// ═══════════════════════════════════════════════════════
// ПАТЧ 3 — swaps: передаём s.shiftDate
// ═══════════════════════════════════════════════════════
applyPatch({
  label: "3. Обмен → передаём s.shiftDate",
  marker: `findWeekIdByShiftId(s.shiftId, s.shiftDate)`,
  find: `const targetWeekId = findWeekIdByShiftId(s.shiftId);`,
  repl: `const targetWeekId = findWeekIdByShiftId(s.shiftId, s.shiftDate);`,
});

// ═══════════════════════════════════════════════════════
// ПАТЧ 4 — shift changes: fallback через дату
// ═══════════════════════════════════════════════════════
applyPatch({
  label: "4. Изменение смены → fallback по newShiftDate",
  marker: `findWeekIdByShiftId(null, r.newShiftDate)`,
  find: `const targetWeekId = r.weekId ?? data?.currentWeek?.id ?? null;`,
  repl: `const targetWeekId = r.weekId ?? findWeekIdByShiftId(null, r.newShiftDate);`,
});

// ═══════════════════════════════════════════════════════
// Итог + сохранение
// ═══════════════════════════════════════════════════════
console.log("\n──────────────────────────────────────");
console.log(`✅ применено:   ${applied}`);
console.log(`⏭  уже было:    ${skipped}`);
console.log(`❌ не найдено:  ${failed}`);
console.log("──────────────────────────────────────");

if (failed > 0) {
  console.error(`\n🚫 ${failed} правок не найдено — файл НЕ сохранён`);
  console.error("   Что не нашлось:", failures.join(", "));
  process.exit(2);
}

if (src === origNormalized) {
  console.log("\n✨ Изменений нет — всё уже на месте.");
  process.exit(0);
}

// ─── Проверки ────────────────────────────────────────
// weeks должен быть в scope
if (!/\bconst\s*\{[^}]*\bweeks\b[^}]*\}\s*=\s*useWeeks\(\)/.test(src)) {
  console.error("\n⚠️  Не нашёл 'const { weeks, ... } = useWeeks();' в файле.");
  console.error("   Без массива weeks поиск по дате не заработает.");
  console.error("   Файл НЕ сохранён. Пришли кусок с useWeeks() — поправлю.");
  process.exit(3);
}

if (DRY_RUN) {
  console.log("\n🔍 dry-run — файл не изменён.");
  process.exit(0);
}

const backup = `${FILE}.bak.${Date.now()}`;
fs.writeFileSync(backup, rawSrc);
fs.writeFileSync(FILE, isCRLF ? src.replace(/\n/g, "\r\n") : src);

console.log(`\n💾 Сохранено: ${FILE}`);
console.log(`📦 Бэкап:    ${backup}`);
console.log("\n➡️  Дальше:");
console.log(`   git diff ${FILE}`);
console.log("   npm run build");