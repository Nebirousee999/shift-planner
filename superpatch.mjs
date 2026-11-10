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

// ═══ ФИНАЛЬНЫЙ ИДЕАЛЬНЫЙ NGINX ═══
writeFile(
  "frontend/nginx.conf",
  `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # 🔥 Лечим баг Docker (зависание CSS на 60 секунд)
    sendfile off;

    # 🔥 Включаем сжатие (CSS/JS будут весить в 5-10 раз меньше)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types
        text/plain
        text/css
        application/json
        application/javascript
        application/x-javascript
        text/xml
        application/xml
        application/xml+rss
        text/javascript
        image/svg+xml;

    # 🔥 Кэшируем статику на 1 год (мгновенная загрузка при повторных визитах)
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

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

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Nginx настроен идеально.");
} else {
  console.log("⚠️ Изменений не внесено.");
}