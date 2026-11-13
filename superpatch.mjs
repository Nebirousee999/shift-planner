// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touchedFiles = 0;

function patchFile(filePath, patches) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Файл не найден: ${filePath}`);
    return;
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let normalized = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;
  let fileChanged = false;

  for (const p of patches) {
    if (p.marker && normalized.includes(p.marker)) {
      console.log(`⏭  [${filePath}] Уже пропатчено: ${p.label}`);
      continue;
    }

    if (normalized.includes(p.search)) {
      normalized = normalized.replace(p.search, p.replace);
      fileChanged = true;
      console.log(`✅ [${filePath}] Исправлено: ${p.label}`);
    } else {
      console.log(`⚠️  [${filePath}] Не найдено место для: ${p.label}`);
    }
  }

  if (fileChanged) {
    fs.writeFileSync(fullPath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touchedFiles++;
  }
}

// ═══════════════════════════════════════════════════════
// ИСПРАВЛЕНИЕ: Убираем время из названия шаблона
// ═══════════════════════════════════════════════════════
patchFile("src/modules/auth/auth.service.ts", [
  {
    label: "Удаление времени из названия шаблона",
    marker: `name: \`Смена \${templatesMap.size + 1}\`,`,
    search: `name: \`Смена \${templatesMap.size + 1} (\${sTime}-\${eTime})\`,`,
    replace: `name: \`Смена \${templatesMap.size + 1}\`,`
  }
]);

if (touchedFiles > 0) {
  console.log(`\n🎉 Успешно! Изменено файлов: ${touchedFiles}`);
  console.log(`⚠️  ОБЯЗАТЕЛЬНО перезапустите бэкенд (npm run dev в корне)!`);
} else {
  console.log(`\n✨ Всё уже на месте.`);
}