import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

// ─── Утилита для безопасной замены (с поддержкой CRLF/LF) ───
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
// 1. ИСПРАВЛЕНИЕ ОШИБОК TYPESCRIPT (чтобы tsc пропустил сборку)
// ═══════════════════════════════════════════════════════════════

// 1.1. Добавляем "passwords" в тип SectionId (ProfilePage.tsx)
patchFile(
  "frontend/src/pages/ProfilePage.tsx",
  `type SectionId =
  | "profile" | "messenger"
  | "requisites" | "modules" | "approval" | "overtime" | "tax" | "appearance";`,
  `type SectionId =
  | "profile" | "messenger"
  | "requisites" | "modules" | "approval" | "overtime" | "tax" | "appearance" | "passwords";`,
  "ProfilePage.tsx (тип SectionId)"
);

// 1.2. Добавляем maxBotLink и maxBotToken в тип update (organization.ts)
patchFile(
  "frontend/src/api/organization.ts",
  `    taxRate?: string;
  }): Promise<Organization> => {`,
  `    taxRate?: string;
    maxBotLink?: string | null;
    maxBotToken?: string | null;
  }): Promise<Organization> => {`,
  "organization.ts (тип update)"
);

// ═══════════════════════════════════════════════════════════════
// 2. ИСПРАВЛЕНИЕ NGINX (чтобы /api/ проксировался на бэкенд в Docker)
// ═══════════════════════════════════════════════════════════════
const nginxPath = path.join(ROOT, "frontend/nginx.conf");
if (fs.existsSync(nginxPath)) {
  const nginxContent = fs.readFileSync(nginxPath, "utf-8");
  if (!nginxContent.includes("location /api/")) {
    const newNginx = `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Проксируем все запросы к API на бэкенд
    location /api/ {
        proxy_pass http://api:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Обработка React (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;
    fs.writeFileSync(nginxPath, newNginx, "utf-8");
    touched++;
    console.log("✅ [nginx.conf] Добавлено проксирование /api/ на бэкенд.");
  } else {
    console.log("⏭  [nginx.conf] Проксирование /api/ уже есть.");
  }
}

// ═══════════════════════════════════════════════════════════════
console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь сборка фронтенда пройдет успешно, а Nginx будет корректно проксировать API.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}