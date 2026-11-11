// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "docker-compose.yml");

if (!fs.existsSync(filePath)) {
  console.log("❌ Файл docker-compose.yml не найден");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const hadCRLF = content.includes("\r\n");
let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

if (normalized.includes("NODE_EXTRA_CA_CERTS")) {
  console.log("⏭  Переменная NODE_EXTRA_CA_CERTS уже есть в файле.");
  process.exit(0);
}

// Ищем блок env_file внутри сервиса api
const search = `    env_file:\n      - .env`;
const replace = `    env_file:\n      - .env\n    environment:\n      - NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`;

if (normalized.includes(search)) {
  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("✅ Готово! В docker-compose.yml добавлен NODE_EXTRA_CA_CERTS.");
} else {
  console.log("⚠️ Не удалось найти блок env_file. Проверьте файл вручную.");
}