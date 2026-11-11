// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  [${label}] файл не найден`); return; }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) { console.log(`⏭  [${label}] уже применено`); return; }

  if (!normalized.includes(search)) {
    console.log(`❌ [${label}] шаблон для замены не найден`);
    return;
  }

  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  touched++;
  console.log(`✅ [${label}] применено`);
}

// ═══ 1. БЭКЕНД: Выносим email админа в переменные окружения ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `const ADMIN_EMAIL = "prihodko999@inbox.ru";`,
  `const ADMIN_EMAIL = process.env.ADMIN_EMAIL;`,
  "support.routes.ts: ADMIN_EMAIL из env"
);

patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";`,
  `const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";\n      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;`,
  "webhooks.routes.ts: проверка поддержки (подготовка)"
);

// ═══ 2. ФРОНТЕНД: Выносим email админа в переменные сборки (Vite) ═══
patchFile(
  "frontend/src/components/NavBar.tsx",
  `if (user?.email !== "prihodko999@inbox.ru") return;`,
  `if (user?.email !== import.meta.env.VITE_ADMIN_EMAIL) return;`,
  "NavBar.tsx: проверка unread (env)"
);

patchFile(
  "frontend/src/components/NavBar.tsx",
  `{user?.email === "prihodko999@inbox.ru" && (`,
  `{user?.email === import.meta.env.VITE_ADMIN_EMAIL && (`,
  "NavBar.tsx: показ кнопки админа (env)"
);

// ═══ 3. ФРОНТЕНД: Пробрасываем переменную через Dockerfile ═══
patchFile(
  "frontend/Dockerfile",
  `ARG VITE_API_URL\nENV VITE_API_URL=$VITE_API_URL`,
  `ARG VITE_API_URL\nENV VITE_API_URL=$VITE_API_URL\n\nARG VITE_ADMIN_EMAIL\nENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL`,
  "frontend/Dockerfile: аргумент сборки"
);

// ═══ 4. DOCKER COMPOSE: Передаем переменную при сборке фронтенда ═══
patchFile(
  "docker-compose.yml",
  `      args:\n        # Передаем адрес API для сборки React\n        - VITE_API_URL=/api`,
  `      args:\n        # Передаем адрес API для сборки React\n        - VITE_API_URL=/api\n        - VITE_ADMIN_EMAIL=\${ADMIN_EMAIL}`,
  "docker-compose.yml: передача VITE_ADMIN_EMAIL"
);

console.log("\n──────────────────────────────────────");
console.log(touched > 0 ? "🎉 Готово! Email админа вынесен в env." : "⚠️ Изменений не внесено.");