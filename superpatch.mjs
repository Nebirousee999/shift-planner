// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "frontend/src/components/OnboardingWidget.tsx");

if (!fs.existsSync(FILE)) {
  console.error("❌ Файл OnboardingWidget.tsx не найден");
  process.exit(1);
}

let content = fs.readFileSync(FILE, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

const search = `  const hasUsers = users.length > 0;
  const hasAreas = areas.length > 0;
  const hasAssignedUsers = users.some((u) => (u.areaIds && u.areaIds.length > 0) || (u.locationIds && u.locationIds.length > 0));`;

const replace = `  // 🔥 Не считаем самого Владельца за добавленного сотрудника
  const hasUsers = users.some((u) => u.id !== user?.id);
  const hasAreas = areas.length > 0;
  const hasAssignedUsers = users.some((u) => u.id !== user?.id && ((u.areaIds && u.areaIds.length > 0) || (u.locationIds && u.locationIds.length > 0)));`;

if (content.includes(replace)) {
  console.log("⏭  [OnboardingWidget.tsx] уже исправлено.");
} else if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("✅ [OnboardingWidget.tsx] Владелец исключен из проверки шагов.");
} else {
  console.log("❌ Не удалось найти блок проверки. Возможно, форматирование изменилось.");
}