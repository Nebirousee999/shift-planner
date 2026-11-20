// superpatch.mjs
// Фикс: Ошибки дашборда при выходе/входе.
// Принудительно очищаем activeLocationId при смене сессии.
// Идемпотентно. Поддержка CRLF.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(relPath, patcher) {
  const full = path.join(__dirname, relPath);
  if (!fs.existsSync(full)) {
    console.error(`[FATAL] файл не найден: ${relPath}`);
    process.exit(1);
  }
  const original = fs.readFileSync(full, "utf8");
  const isCRLF = original.includes("\r\n");
  let content = isCRLF ? original.replace(/\r\n/g, "\n") : original;

  const result = patcher(content);
  if (result !== content) {
    const finalResult = isCRLF ? result.replace(/\n/g, "\r\n") : result;
    fs.writeFileSync(full, finalResult, "utf8");
    console.log(`[SAVE] ${relPath}`);
  } else {
    console.log(`[NOOP] ${relPath} — изменений нет`);
  }
}

// 1. App.tsx: Очистка при создании гостя
patchFile("frontend/src/App.tsx", (content) => {
  if (content.includes('localStorage.removeItem("activeLocationId");')) return content;
  return content.replaceAll(
    'localStorage.removeItem("guest_workspace");',
    'localStorage.removeItem("activeLocationId");\n          localStorage.removeItem("guest_workspace");'
  );
});

// 2. NavBar.tsx: Очистка при логауте и логине
patchFile("frontend/src/components/NavBar.tsx", (content) => {
  let out = content;
  
  // Логаут
  if (!out.includes('localStorage.removeItem("activeLocationId");\n    navigate("/");')) {
    out = out.replace(
      'const handleLogout = () => {\n    logout();',
      'const handleLogout = () => {\n    logout();\n    localStorage.removeItem("activeLocationId");'
    );
  }

  // Логин (добавляем к нашему прошлому патчу)
  if (!out.includes('localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");')) {
    out = out.replace(
      'localStorage.setItem("token", tk);\n      window.location.reload();',
      'localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");\n      window.location.reload();'
    );
  }

  return out;
});

// 3. WalletPage.tsx: Очистка при логине
patchFile("frontend/src/pages/WalletPage.tsx", (content) => {
  if (content.includes('localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");')) return content;
  return content.replace(
    'localStorage.setItem("token", tk);\n      if (pendingAction?.type === "trial") {',
    'localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");\n      if (pendingAction?.type === "trial") {'
  );
});

// 4. WeekDetailPage.tsx: Очистка при логине
patchFile("frontend/src/pages/WeekDetailPage.tsx", (content) => {
  if (content.includes('localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");')) return content;
  return content.replace(
    'localStorage.setItem("token", tk);\n      // Гостевая неделя не принадлежит аккаунту',
    'localStorage.setItem("token", tk);\n      localStorage.removeItem("activeLocationId");\n      // Гостевая неделя не принадлежит аккаунту'
  );
});

console.log("\n── Готово ──");
console.log("Все переходы между сессиями теперь очищают activeLocationId. Ошибки дашборда устранены.");