import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'frontend', 'public');

console.log("⏳ Исправляем внутренние ссылки в сгенерированных HTML-файлах...");

if (!fs.existsSync(publicDir)) {
  console.error("❌ Папка public не найдена");
  process.exit(1);
}

// Получаем список всех папок в public
const folders = fs.readdirSync(publicDir).filter(f => {
  const fullPath = path.join(publicDir, f);
  return fs.statSync(fullPath).isDirectory() && f.startsWith('grafik-');
});

let patchedCount = 0;

folders.forEach(folder => {
  const filePath = path.join(publicDir, folder, 'index.html');
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Ищем все ссылки вида href="/grafik-..." 
  // и заменяем на href="/grafik-.../index.html"
  content = content.replace(/href="(\/grafik-[^"]+)"/g, (match, p1) => {
    // Если ссылка уже заканчивается на .html или слеш, не трогаем
    if (p1.endsWith('.html') || p1.endsWith('/')) return match;
    // Иначе добавляем /index.html
    return `href="${p1}/index.html"`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  patchedCount++;
});

console.log(`✅ Успех! Исправлены ссылки в ${patchedCount} HTML-файлах.`);
console.log("👉 Теперь при клике внутри статьи вы будете переходить на другие статьи, а не на лендинг.");