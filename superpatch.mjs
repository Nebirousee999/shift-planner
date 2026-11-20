// superpatch.mjs
// Задача: после "Выйти" пользователь попадает в гостевой режим
//   - с видимым жёлтым баннером (guestEmailAttached удалён)
//   - без кнопок "Профиль"/"Выйти" (isGuest = "true")
//   - при реальном login/register гостевые флаги снимаются
//
// Что делает скрипт:
//   - Патчит ТОЛЬКО auth.ts, только login() и register().
//   - logout() не трогает (там уже стоят сброс guestEmailAttached и isGuest="true").
//   - Находит присвоение localStorage.setItem("user", JSON.stringify(data.user));
//     и вставляет ПОСЛЕ него снятие guest-флагов.
//   - Устойчив к CRLF/LF (Windows/Unix), к отступам и комментариям.
//   - Идемпотентен: повторный запуск ничего не сломает.
//
// Запуск:  node superpatch.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = "frontend/src/store/auth.ts";
const fullPath = path.join(__dirname, file);

if (!fs.existsSync(fullPath)) {
  console.error(`[FATAL] файл не найден: ${file}`);
  console.error(`        ожидался путь: ${fullPath}`);
  process.exit(1);
}

let content = fs.readFileSync(fullPath, "utf8");
const original = content;

// Определяем стиль переносов строк в файле
const eol = content.includes("\r\n") ? "\r\n" : "\n";
console.log(
  `[INFO] line ending в файле: ${eol === "\r\n" ? "CRLF" : "LF"}`,
);

// ─────────────────────────────────────────────────────────────
// Патчим login() и register().
// Единственный надёжный маркер — однострочное присвоение user.
// ─────────────────────────────────────────────────────────────
const userSetRe =
  /(localStorage\.setItem\("user", JSON\.stringify\(data\.user\)\);)/g;

let applied = 0;

content = content.replace(userSetRe, (match, _p1, offset, full) => {
  // Смотрим 200 символов вперёд: если там уже есть removeItem("isGuest") —
  // значит этот блок уже пропатчен, пропускаем (идемпотентность).
  const after = full.slice(offset + match.length, offset + match.length + 200);
  if (after.includes('localStorage.removeItem("isGuest")')) {
    return match;
  }

  applied++;
  return (
    match +
    eol +
    '      // Реальный вход — снимаем гостевые флаги' +
    eol +
    '      localStorage.removeItem("isGuest");' +
    eol +
    '      localStorage.removeItem("guestEmailAttached");'
  );
});

if (content !== original) {
  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`[SAVE] ${file} — вставлено блоков: ${applied}`);
} else {
  console.log(`[NOOP] изменений нет (всё уже пропатчено или маркер не найден)`);
}

// ─────────────────────────────────────────────────────────────
// Проверка результата
// ─────────────────────────────────────────────────────────────
console.log("\n── Проверка auth.ts ──");

const checks = [
  {
    label: "logout(): isGuest = 'true'",
    re: /localStorage\.setItem\("isGuest",\s*"true"\)/g,
    expectMin: 1,
  },
  {
    label: "guestEmailAttached удаляется (logout + login/register)",
    re: /localStorage\.removeItem\("guestEmailAttached"\)/g,
    expectMin: 2,
  },
  {
    label: "isGuest удаляется (login + register)",
    re: /localStorage\.removeItem\("isGuest"\)/g,
    expectMin: 2,
  },
];

let allOk = true;
for (const c of checks) {
  const n = (content.match(c.re) || []).length;
  const ok = n >= c.expectMin;
  if (!ok) allOk = false;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label}  (встреч: ${n}, нужно ≥${c.expectMin})`);
}

// Дополнительно: показать фрагменты login()/register(), чтобы визуально убедиться
console.log("\n── Фрагменты вокруг setItem(\"user\") ──");
const showRe =
  /localStorage\.setItem\("user", JSON\.stringify\(data\.user\)\);[\s\S]{0,260}?resetOrganizationStore\(\);/g;
const fragments = content.match(showRe) || [];
if (fragments.length === 0) {
  console.log("  (не найдено ни одного блока login/register)");
} else {
  fragments.forEach((frag, i) => {
    console.log(`  --- блок #${i + 1} ---`);
    console.log(
      frag
        .split("\n")
        .map((l) => "    " + l)
        .join("\n"),
    );
  });
}

console.log(
  "\n" + (allOk ? "ВСЁ ОК — можно проверять в браузере" : "ЕСТЬ ПРОБЛЕМЫ — см. ✗ выше"),
);