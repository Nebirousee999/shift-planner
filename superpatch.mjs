// superpatch.mjs
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

function patchFile(relPath, replacements) {
  const filePath = resolve(process.cwd(), relPath);
  if (!existsSync(filePath)) {
    console.error(`✗ Файл не найден: ${relPath}`);
    process.exit(1);
  }

  let content = readFileSync(filePath, "utf8");
  let applied = 0;

  for (const { from, to } of replacements) {
    if (!from.test(content)) {
      console.log(`- Паттерн не найден (возможно, уже применен) в ${relPath}`);
      continue;
    }
    content = content.replace(from, to);
    applied++;
  }

  writeFileSync(filePath, content, "utf8");
  console.log(`✓ ${relPath} — применено замен: ${applied}`);
}

patchFile("frontend/src/pages/AnalyticsPage.tsx", [
  // 1. Добавляем проверку на демо-режим и отключаем isFree для гостя
  {
    from: /const effectiveTariff = isTrial \? "pro" : \(isPaid \? org\?\.tariffId : "free"\);\s*const isFree = effectiveTariff === "free";/,
    to: `const isDemo = localStorage.getItem("isGuest") === "true";
  const effectiveTariff = isTrial ? "pro" : (isPaid ? org?.tariffId : "free");
  const isFree = effectiveTariff === "free" && !isDemo;`
  },
  
  // 2. Разрешаем загрузку MOCK_DATA в демо-режиме (чтобы не шло в реальный API)
  {
    from: /if \(isFree && !isEmployee\) \{\s*setTimeout\(\(\) => \{\s*setData\(MOCK_DATA\);\s*setLoading\(false\);\s*\}, 200\);\s*return;\s*\}/,
    to: `if (isDemo || (isFree && !isEmployee)) {
      setTimeout(() => {
        setData(MOCK_DATA);
        setLoading(false);
      }, 200);
      return;
    }`
  }
]);

console.log("\nПравка применена успешно.");