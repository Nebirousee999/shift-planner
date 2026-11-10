// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) return;

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⚠️ [" + label + "] Не найдено (возможно, уже изменено).");
  }
}

function createFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Перезаписан");
}

// ═══ 1. Фикс Nginx для Docker (убирает ERR_CONTENT_LENGTH_MISMATCH) ═══
createFile(
  "frontend/nginx.conf",
  `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # 🔥 Отключаем sendfile, чтобы Nginx не обрывал передачу файлов в Docker
    sendfile off;
    gzip off;

    # Проксируем все запросы к API на бэкенд
    location /api/ {
        proxy_pass http://api:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # Обработка React (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
  "frontend/nginx.conf"
);

// ═══ 2. Фикс 401 ошибки в консоли (OnboardingWidget) ═══
patchFile(
  "frontend/src/components/OnboardingWidget.tsx",
  `    if (user?.role !== "EMPLOYEE" && !isDismissed) {`,
  `    if (user && user.role !== "EMPLOYEE" && !isDismissed) {`,
  "OnboardingWidget.tsx (запрет запросов для гостей)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}