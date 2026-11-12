// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "frontend/vite.config.ts");

if (!fs.existsSync(FILE)) {
  console.error("❌ Файл vite.config.ts не найден");
  process.exit(1);
}

let content = fs.readFileSync(FILE, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

// Проверяем, есть ли уже envDir
if (content.includes('envDir: ".."')) {
  console.log("⏭  [vite.config.ts] envDir уже настроен.");
} else {
  // Ищем начало defineConfig и вставляем envDir сразу после открывающей скобки
  const searchRegex = /export default defineConfig\(\{/;
  
  if (searchRegex.test(content)) {
    content = content.replace(searchRegex, 'export default defineConfig({\n  envDir: "..", // 🔥 Позволяет Vite читать корневой .env');
    fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
    console.log("✅ [vite.config.ts] Успешно добавлен envDir: '..' (Vite будет видеть корневой .env).");
  } else {
    console.log("❌ Не удалось найти defineConfig в файле.");
  }
}