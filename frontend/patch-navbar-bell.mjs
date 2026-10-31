// patch-navbar-bell-v2.mjs
// Вставляет <NotificationBell /> перед всеми Help-кнопками (разная верстка — не проблема)
// Запуск: node patch-navbar-bell-v2.mjs [--dry-run]

import fs from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");
const FILE = ["src/components/NavBar.tsx", "components/NavBar.tsx"].find(fs.existsSync);

if (!FILE) { console.error("❌ NavBar.tsx не найден"); process.exit(1); }
console.log(`📄 ${FILE}`);

const raw = fs.readFileSync(FILE, "utf8");
const isCRLF = raw.includes("\r\n");
let src = isCRLF ? raw.replace(/\r\n/g, "\n") : raw;
const orig = src;

if (!/import\s+NotificationBell\s+from/.test(src)) {
  console.error("❌ Нет импорта NotificationBell. Сначала patch-notifications-frontend.mjs");
  process.exit(1);
}

const lines = src.split("\n");

// Найти все строки, где есть navigate("/help") (или '/help' одинарные)
const helpLineIdxs = [];
for (let i = 0; i < lines.length; i++) {
  if (/navigate\(\s*["']\/help["']\s*\)/.test(lines[i])) helpLineIdxs.push(i);
}
console.log(`🔍 Найдено navigate("/help"): ${helpLineIdxs.length} на строках ${helpLineIdxs.map(i => i + 1).join(", ")}`);

if (helpLineIdxs.length === 0) { console.error("❌ Не найдено ни одной Help-кнопки"); process.exit(2); }

// Для каждого — подняться до ближайшего <button
const buttonIdxs = [];
for (const helpIdx of helpLineIdxs) {
  let btnIdx = -1;
  for (let k = helpIdx; k >= Math.max(0, helpIdx - 5); k--) {
    if (lines[k].includes("<button")) { btnIdx = k; break; }
  }
  if (btnIdx === -1) {
    console.warn(`⚠️  Строка ${helpIdx + 1}: не нашёл <button выше`);
    continue;
  }
  // Уже вставлено?
  const before = lines.slice(Math.max(0, btnIdx - 3), btnIdx).join("\n");
  if (before.includes("<NotificationBell")) {
    console.log(`⏭  строка ${btnIdx + 1}: Bell уже есть перед кнопкой`);
    continue;
  }
  buttonIdxs.push(btnIdx);
}

console.log(`🎯 Вставить Bell перед ${buttonIdxs.length} кнопками`);

if (buttonIdxs.length === 0) { console.log("✨ Нечего вставлять — всё уже на месте"); process.exit(0); }

// Вставляем с КОНЦА, чтобы индексы не съезжали
buttonIdxs.sort((a, b) => b - a);
for (const idx of buttonIdxs) {
  const indent = lines[idx].match(/^\s*/)[0];
  lines.splice(idx, 0, `${indent}<NotificationBell />`);
  console.log(`✅ вставлено перед строкой ${idx + 1}`);
}

src = lines.join("\n");

if (DRY_RUN) { console.log("\n🔍 dry-run — не сохраняю"); process.exit(0); }

fs.writeFileSync(`${FILE}.bak.${Date.now()}`, raw);
fs.writeFileSync(FILE, isCRLF ? src.replace(/\n/g, "\r\n") : src);
console.log(`\n💾 Сохранено: ${FILE}`);

// Финальная проверка
const finalSrc = fs.readFileSync(FILE, "utf8");
const finalBell = (finalSrc.match(/<NotificationBell\s*\/>/g) || []).length;
const finalHelp = (finalSrc.match(/navigate\(\s*["']\/help["']\s*\)/g) || []).length;
console.log(`\n🔍 Итог: Help-кнопок ${finalHelp}, NotificationBell ${finalBell}`);
if (finalBell < finalHelp) console.warn("⚠️  Bell меньше, чем Help — проверь глазами");
else console.log("✅ Всё на месте");