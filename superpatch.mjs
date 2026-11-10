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

// ═══ 1. Исправляем Vite: оставляем в vendor ТОЛЬКО React ═══
writeFile(
  "frontend/vite.config.ts",
  `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Планировщик смен",
        short_name: "Смены",
        description: "Планирование смен, учёт рабочего времени и отпусков для микробизнеса",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "ru",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\\/api/],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // В vendor кладем ТОЛЬКО ядро React
            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("react-router-dom") ||
              id.includes("zustand")
            ) {
              return "react-vendor";
            }
            // Остальное (docx, axios, lucide и т.д.) Rollup сам разобьет на чанки
          }
        },
      },
    },
  },
});
`,
  "frontend/vite.config.ts"
);

// ═══ 2. Починяем Nginx (подключаем mime.types, чтобы Gzip заработал) ═══
writeFile(
  "frontend/nginx.conf",
  `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # 🔥 Подключаем типы файлов (без этого gzip не понимает, что сжимать)
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 🔥 Лечим баг Docker
    sendfile off;

    # 🔥 Включаем сжатие
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

    # Кэширование статики
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API
    location /api/ {
        proxy_pass http://api:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
  "frontend/nginx.conf"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Конфиги Vite и Nginx оптимизированы.");
} else {
  console.log("⚠️ Изменений не внесено.");
}