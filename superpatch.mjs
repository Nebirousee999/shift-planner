import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Файл не найден: ${relPath}`);
    return;
  }
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

// ═══════════════════════════════════════════════════════════════
// 1. Скрываем OnboardingWidget для неавторизованных пользователей
// ═══════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/components/OnboardingWidget.tsx",
  `  // Показываем только владельцам и менеджерам
  if (user?.role === "EMPLOYEE" || isDismissed) return null;`,
  `  // Показываем только авторизованным владельцам и менеджерам
  if (!user || user.role === "EMPLOYEE" || isDismissed) return null;`,
  "OnboardingWidget.tsx (скрыть для гостей)"
);

// ═══════════════════════════════════════════════════════════════
// 2. Убираем жесткий редирект на /login при 401 ошибке
// ═══════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/api/client.ts",
  `    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }`,
  `    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Жесткий редирект убран, чтобы не выкидывать с лендинга на логин
    }`,
  "client.ts (удален жесткий редирект на логин)"
);

// ═══════════════════════════════════════════════════════════════
console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь можно коммитить и пушить.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}