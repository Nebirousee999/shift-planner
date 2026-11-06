import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function patchFile(p, replaces) {
  const filePath = path.join(ROOT, p);
  if (!fs.existsSync(filePath)) return console.log(`⚠ ${p} not found`);
  
  const raw = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let c = raw.replace(/\r\n/g, "\n");
  let touched = 0;

  for (const [from, to] of replaces) {
    if (c.includes(from)) { 
      c = c.replace(from, to); 
      touched++; 
    }
  }

  if (touched > 0) {
    fs.writeFileSync(filePath, hadCRLF ? c.replace(/\n/g, "\r\n") : c, "utf-8");
    console.log(`✔ ${p} (${touched} замен)`);
  } else {
    console.log(`⚠ ${p} (совпадений не найдено)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Исправляем классы у картинки во всех файлах
// ═══════════════════════════════════════════════════════════════

// 1. LandingHeader (размер w-9 h-9)
patchFile("frontend/src/components/landing/LandingHeader.tsx", [
  [
    `className="w-9 h-9 rounded-xl object-cover"`,
    `className="w-9 h-9 object-contain"`
  ]
]);

// 2. NavBar (размер w-8 h-8, два места)
patchFile("frontend/src/components/NavBar.tsx", [
  [
    `className="w-8 h-8 rounded-lg object-cover"`,
    `className="w-8 h-8 object-contain"`
  ]
]);

// 3. LoginPage (размер w-12 h-12)
patchFile("frontend/src/pages/LoginPage.tsx", [
  [
    `className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-brand-500/20"`,
    `className="w-12 h-12 object-contain shadow-lg shadow-brand-500/20"`
  ]
]);

// 4. LandingFooter (размер w-8 h-8)
patchFile("frontend/src/components/landing/LandingFooter.tsx", [
  [
    `className="w-8 h-8 rounded-lg object-cover"`,
    `className="w-8 h-8 object-contain"`
  ]
]);

console.log("\n✅ Картинки исправлены! Убрано обрезание углов (заменено на object-contain).");