// superpatch.mjs
// Диагностика + фикс админ-кнопок: константа ADMIN_EMAIL с фолбэком в NavBar
// и временный console.log для проверки в браузере.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(relPath, patcher) {
  const full = path.join(__dirname, relPath);
  if (!fs.existsSync(full)) {
    console.log(`[SKIP] ${relPath} не найден`);
    return;
  }
  const original = fs.readFileSync(full, "utf8");
  const isCRLF = original.includes("\r\n");
  let content = isCRLF ? original.replace(/\r\n/g, "\n") : original;
  let result;
  try {
    result = patcher(content);
  } catch (e) {
    console.log(`[ERROR] ${relPath}: ${e.message} — файл не тронут`);
    return;
  }
  if (result !== content) {
    fs.writeFileSync(full, isCRLF ? result.replace(/\n/g, "\r\n") : result, "utf8");
    console.log(`[SAVE] ${relPath}`);
  } else {
    console.log(`[NOOP] ${relPath} — изменений нет`);
  }
}

patchFile("frontend/src/components/NavBar.tsx", (out) => {
  // 1. Есть ли константа?
  const hasConst = out.includes("const ADMIN_EMAIL =");
  if (!hasConst) {
    const anchor = "function isActive(pathname: string, path: string): boolean {";
    const idx = out.indexOf(anchor);
    if (idx === -1) throw new Error("якорь isActive не найден — NavBar менялся извне");
    out = out.slice(0, idx) +
      'const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "prihodko999@inbox.ru";\n\n' +
      out.slice(idx);
    console.log("  [PATCH] константа ADMIN_EMAIL добавлена");
  } else {
    console.log("  [INFO] константа ADMIN_EMAIL уже есть");
    // Покажем, как она выглядит — вдруг фолбэка нет
    const m = /const ADMIN_EMAIL = (.+?);/.exec(out);
    if (m) console.log(`  [INFO] объявление: ${m[1]}`);
  }

  // 2. Заменяем все прямые проверки на константу
  const checks = [
    ["import.meta.env.VITE_ADMIN_EMAIL", "ADMIN_EMAIL"],
    ['user?.email === "prihodko999@inbox.ru"', "user?.email === ADMIN_EMAIL"],
  ];
  for (const [from, to] of checks) {
    // не трогаем само объявление константы
    const parts = out.split(from);
    if (parts.length > 1) {
      out = parts[0] + "const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? \"prihodko999@inbox.ru\";" +
        parts.slice(1).join(to);
      console.log(`  [PATCH] заменил вхождения "${from}" на ADMIN_EMAIL`);
    }
  }

  // 3. Временный диагностический лог (уберём после проверки)
  const logAnchor = "const isAdmin = user?.role === \"OWNER\" || user?.role === \"MANAGER\";";
  if (out.includes(logAnchor) && !out.includes("ADMIN_DEBUG")) {
    out = out.replace(
      logAnchor,
      logAnchor +
      `\n  // ADMIN_DEBUG — временный лог, удалить после диагностики
  console.log("[ADMIN_DEBUG] user.email:", JSON.stringify(user?.email), "| ADMIN_EMAIL:", JSON.stringify(ADMIN_EMAIL), "| match:", user?.email === ADMIN_EMAIL);`
    );
    console.log("  [PATCH] добавлен диагностический лог ADMIN_DEBUG");
  }

  // 4. Отчёт: какие проверки по email остались в файле
  const lines = out.split("\n").filter((l) => l.includes("ADMIN_EMAIL") || l.includes("prihodko999"));
  console.log("  [REPORT] строки с проверками админа:");
  lines.forEach((l) => console.log("    | " + l.trim().slice(0, 120)));

  return out;
});

// Отчёт по env-файлам
for (const p of [".env", "frontend/.env.local"]) {
  const full = path.join(__dirname, p);
  if (fs.existsSync(full)) {
    const m = /^VITE_ADMIN_EMAIL=(.*)$/m.exec(fs.readFileSync(full, "utf8"));
    console.log(`[INFO] ${p}: VITE_ADMIN_EMAIL = ${m ? `"${m[1].trim()}"` : "не найден"}`);
  } else {
    console.log(`[INFO] ${p}: файл не существует`);
  }
}

console.log("\nДальше: перезапустите dev-сервер (Ctrl+C → npm run dev), обновите страницу, откройте консоль браузера (F12) и пришлите строку [ADMIN_DEBUG].");
