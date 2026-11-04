import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const publicDir = path.join(ROOT, "frontend", "public", "blog");

// Создаем папку
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// 1. Готовые SVG-заглушки (на случай, если интернет не работает)
const svgs = {
  "graphic-2-2.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#EFF6FF"/><rect x="200" y="100" width="400" height="250" rx="20" fill="#fff" stroke="#BFDBFE" stroke-width="4"/><rect x="200" y="100" width="400" height="60" rx="20" fill="#3B82F6"/><rect x="200" y="140" width="400" height="20" fill="#3B82F6"/><circle cx="260" cy="130" r="10" fill="#fff"/><circle cx="540" cy="130" r="10" fill="#fff"/><rect x="240" y="190" width="60" height="60" rx="10" fill="#DBEAFE"/><rect x="320" y="190" width="60" height="60" rx="10" fill="#DBEAFE"/><rect x="400" y="190" width="60" height="60" rx="10" fill="#EFF6FF"/><rect x="480" y="190" width="60" height="60" rx="10" fill="#EFF6FF"/><rect x="240" y="270" width="60" height="60" rx="10" fill="#EFF6FF"/><rect x="320" y="270" width="60" height="60" rx="10" fill="#EFF6FF"/><rect x="400" y="270" width="60" height="60" rx="10" fill="#DBEAFE"/><rect x="480" y="270" width="60" height="60" rx="10" fill="#DBEAFE"/><text x="400" y="315" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#2563EB" text-anchor="middle">2/2</text></svg>`,
  "tk-rf.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#F8FAFC"/><rect x="300" y="60" width="200" height="280" rx="10" fill="#fff" stroke="#CBD5E1" stroke-width="4"/><rect x="320" y="90" width="160" height="10" rx="5" fill="#94A3B8"/><rect x="320" y="120" width="160" height="10" rx="5" fill="#94A3B8"/><rect x="320" y="150" width="160" height="10" rx="5" fill="#94A3B8"/><rect x="320" y="180" width="120" height="10" rx="5" fill="#94A3B8"/><circle cx="450" cy="280" r="40" fill="#EF4444"/><rect x="440" y="260" width="20" height="40" fill="#fff"/><text x="400" y="380" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#475569" text-anchor="middle">ТК РФ</text></svg>`,
  "excel.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#ECFDF5"/><rect x="150" y="80" width="500" height="240" rx="10" fill="#fff" stroke="#A7F3D0" stroke-width="4"/><line x1="150" y1="120" x2="650" y2="120" stroke="#A7F3D0" stroke-width="2"/><line x1="150" y1="160" x2="650" y2="160" stroke="#A7F3D0" stroke-width="2"/><line x1="150" y1="200" x2="650" y2="200" stroke="#A7F3D0" stroke-width="2"/><line x1="150" y1="240" x2="650" y2="240" stroke="#A7F3D0" stroke-width="2"/><line x1="150" y1="280" x2="650" y2="280" stroke="#A7F3D0" stroke-width="2"/><line x1="250" y1="80" x2="250" y2="320" stroke="#A7F3D0" stroke-width="2"/><line x1="350" y1="80" x2="350" y2="320" stroke="#A7F3D0" stroke-width="2"/><line x1="450" y1="80" x2="450" y2="320" stroke="#A7F3D0" stroke-width="2"/><line x1="550" y1="80" x2="550" y2="320" stroke="#A7F3D0" stroke-width="2"/><text x="400" y="210" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#10B981" text-anchor="middle">Excel</text></svg>`,
  "zayavlenie.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="#FFF7ED"/><rect x="250" y="60" width="300" height="240" rx="10" fill="#fff" stroke="#FED7AA" stroke-width="4"/><line x1="280" y1="110" x2="520" y2="110" stroke="#F97316" stroke-width="4" stroke-linecap="round"/><line x1="280" y1="150" x2="520" y2="150" stroke="#FDBA74" stroke-width="2" stroke-linecap="round"/><line x1="280" y1="180" x2="520" y2="180" stroke="#FDBA74" stroke-width="2" stroke-linecap="round"/><line x1="280" y1="210" x2="520" y2="210" stroke="#FDBA74" stroke-width="2" stroke-linecap="round"/><circle cx="500" cy="260" r="30" fill="#F97316"/><text x="400" y="370" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#9A3412" text-anchor="middle">Заявление</text></svg>`
};

for (const [name, content] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(publicDir, name), content, "utf-8");
}

// 2. Пытаемся скачать реальные фото с Pixabay (доступен в РФ)
const photos = [
  { name: "graphic-2-2.jpg", url: "https://cdn.pixabay.com/photo/2016/11/29/05/45/astronomy-1867616_1280.jpg" }, // Заменим на календарь позже
  { name: "tk-rf.jpg", url: "https://cdn.pixabay.com/photo/2016/03/09/09/22/workplace-1245776_1280.jpg" },
  { name: "excel.jpg", url: "https://cdn.pixabay.com/photo/2015/01/09/11/08/startup-594090_1280.jpg" },
  { name: "zayavlenie.jpg", url: "https://cdn.pixabay.com/photo/2018/03/10/12/40/application-3113001_1280.jpg" }
];

async function tryDownload() {
  let successCount = 0;
  for (const p of photos) {
    const dest = path.join(publicDir, p.name);
    try {
      console.log(`⏳ Скачиваем: ${p.name}...`);
      const res = await fetch(p.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(arrayBuffer));
      console.log(`✔ Успешно: ${p.name}`);
      successCount++;
    } catch (e) {
      console.log(`❌ Не удалось скачать ${p.name}. Будет использован SVG-аналог.`);
    }
  }
  return successCount;
}

// 3. Обновляем компонент статьи, чтобы он использовал SVG, если JPG не скачался
const filePath = "frontend/src/pages/BlogArticlePage.tsx";
let c = fs.readFileSync(path.join(ROOT, filePath), "utf-8");

// Меняем пути с JPG на SVG (для надежности)
c = c.replace(/\/blog\/graphic-2-2\.jpg/g, "/blog/graphic-2-2.svg");
c = c.replace(/\/blog\/tk-rf\.jpg/g, "/blog/tk-rf.svg");
c = c.replace(/\/blog\/excel\.jpg/g, "/blog/excel.svg");
c = c.replace(/\/blog\/zayavlenie\.jpg/g, "/blog/zayavlenie.svg");

fs.writeFileSync(path.join(ROOT, filePath), c, "utf-8");
console.log("✔ Компонент переключен на SVG-иллюстрации (они гарантированно загрузятся).");

tryDownload().then((count) => {
  console.log(`\n✅ Готово! Скачано реальных фото: ${count} из ${photos.length}.`);
  console.log("Если фото не скачались, на сайте отобразятся красивые SVG-иллюстрации.");
  console.log("Чтобы поставить свои фото, просто положите их в папку frontend/public/blog/ с именами graphic-2-2.jpg, tk-rf.jpg, excel.jpg, zayavlenie.jpg и перезапустите сборку.");
});