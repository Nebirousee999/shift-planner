// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function writeFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Перезаписан");
}

// ═══ Возвращаем СТАНДАРТНЫЙ, быстрый Nginx ═══
writeFile(
  "frontend/nginx.conf",
  `server {
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
`,
  "frontend/nginx.conf"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Nginx восстановлен до стандартной быстрой конфигурации.");
} else {
  console.log("⚠️ Изменений не внесено.");
}