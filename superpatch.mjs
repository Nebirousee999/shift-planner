// superpatch.mjs
// ─── СУПЕРПАТЧ: Фикс парсинга данных при создании сотрудника ────────────────
import fs from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const file = 'frontend/src/api/client.ts';

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  СУПЕРПАТЧ: Фикс создания сотрудника ${DRY_RUN ? "[DRY-RUN]" : "[APPLY]"}`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (!fs.existsSync(file)) {
  console.error(`❌ Файл ${file} не найден!`);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
let changed = false;

// Ищем проблемную строку в блоке POST /users
const oldParse = `const body = JSON.parse(config.data || "{}");`;
const newParse = `const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});`;

if (src.includes(oldParse)) {
  src = src.replace(oldParse, newParse);
  changed = true;
  console.log("✅ Исправлен парсинг данных (теперь объект не ломает JSON.parse).");
} else {
  console.log("⏭  Проблемная строка не найдена. Возможно, патч уже применен.");
}

if (changed) {
  if (DRY_RUN) {
    console.log(`\n🔍 [DRY-RUN] Файл ${file} будет обновлен.`);
  } else {
    fs.writeFileSync(`${file}.bak.${Date.now()}`, fs.readFileSync(file));
    fs.writeFileSync(file, src);
    console.log(`\n💾 Сохранено: ${file}`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
if (!DRY_RUN) {
  console.log("✅ ГОТОВО! Перезапусти Vite и обнови страницу.");
  console.log("👉 Теперь создание сотрудника будет проходить успешно (и показывать временный пароль).");
}
console.log("═══════════════════════════════════════════════════════════════\n");