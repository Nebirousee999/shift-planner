import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "frontend/src/pages/WeekDetailPage.tsx");

if (!fs.existsSync(filePath)) {
  console.log("❌ Файл WeekDetailPage.tsx не найден!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const hadCRLF = content.includes("\r\n");
let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

// Меняем Clipboard на CopyPlus в импортах
if (normalized.includes("Clipboard,")) {
  normalized = normalized.replace("Clipboard,", "CopyPlus,");
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log("✅ [WeekDetailPage.tsx] Импорт CopyPlus успешно добавлен (вместо Clipboard).");
} else if (normalized.includes("Clipboard }")) {
  normalized = normalized.replace("Clipboard }", "CopyPlus }");
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log("✅ [WeekDetailPage.tsx] Импорт CopyPlus успешно добавлен (вместо Clipboard).");
} else {
  console.log("⏭  Импорт уже исправлен или Clipboard не найден.");
}