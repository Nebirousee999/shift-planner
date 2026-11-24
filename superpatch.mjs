// superpatch.mjs
// Правка: плашка времени внутри полосы берет цвет ИЗ ШАБЛОНА СМЕНЫ,
// рамка - 100% цвета шаблона, фон - 50% цвета шаблона.

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

  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.error(`✗ Паттерн не найден в ${relPath}:`);
      console.error("---");
      console.error(from);
      console.error("---");
      process.exit(1);
    }
    content = content.replace(from, to);
    applied++;
  }

  writeFileSync(filePath, content, "utf8");
  console.log(`✓ ${relPath} — применено замен: ${applied}`);
}

patchFile("frontend/src/pages/DashboardPage.tsx", [
  [
    // Ищем блок стилей, который мы сделали в прошлом патче
    `        backgroundColor: shift.pendingTimeOff 
          ? "rgba(217, 119, 6, 0.5)" 
          : \`\${shift.userColor || shift.templateColor || "#3b82f6"}80\`,
        borderColor: shift.pendingTimeOff 
          ? "#d97706" 
          : (shift.userColor || shift.templateColor || "#3b82f6")`,
          
    // Убираем userColor, оставляем только templateColor
    `        backgroundColor: shift.pendingTimeOff 
          ? "rgba(217, 119, 6, 0.5)" 
          : \`\${shift.templateColor || "#3b82f6"}80\`,
        borderColor: shift.pendingTimeOff 
          ? "#d97706" 
          : (shift.templateColor || "#3b82f6")`
  ]
]);

console.log("\nПравка применена успешно.");