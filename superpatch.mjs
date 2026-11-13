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

    if (p.regex) {
      if (p.regex.test(normalized)) {
        normalized = normalized.replace(p.regex, p.replace);
        fileChanged = true;
        console.log(`✅ [${filePath}] Исправлено (regex): ${p.label}`);
      } else {
        console.log(`⚠️  [${filePath}] Не найдено (regex): ${p.label}`);
      }
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

// 1. frontend/src/api/users.ts — добавляем email и tempPassword в тип
patchFile("frontend/src/api/users.ts", [
  {
    label: "Добавление email и tempPassword в тип update",
    regex: /employmentType\?: "GPH" \| "SHTAT";\s*\}\>/g,
    replace: `employmentType?: "GPH" | "SHTAT";
      email?: string;
      tempPassword?: string | null;
    }>`
  }
]);

// 2. frontend/src/pages/TeamPage.tsx — убираем лишний каст (res as any)
patchFile("frontend/src/pages/TeamPage.tsx", [
  {
    label: "Удаление каста (res as any) для tempPassword",
    search: `if (res && (res as any).tempPassword) {
                if (confirm(\`Сотруднику сгенерирован новый пароль: \${(res as any).tempPassword}\\n\\nОтправить его сотруднику на почту?\`)) {`,
    replace: `if (res && res.tempPassword) {
                if (confirm(\`Сотруднику сгенерирован новый пароль: \${res.tempPassword}\\n\\nОтправить его сотруднику на почту?\`)) {`
  }
]);

if (touchedFiles > 0) {
  console.log(`\n🎉 Успешно! Изменено файлов: ${touchedFiles}`);
  console.log(`⚠️  Теперь нужно запушить изменения и пересобрать сервер:`);
  console.log(`    git add .`);
  console.log(`    git commit -m "fix: TS build errors"`);
  console.log(`    git push origin main`);
  console.log(`    Затем на сервере: bash deploy.sh`);
} else {
  console.log(`\n✨ Всё уже на месте.`);
}