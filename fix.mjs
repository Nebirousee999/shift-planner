import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "src/modules/users/users.service.ts");

if (!fs.existsSync(filePath)) {
  console.error("❌ Файл не найден:", filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

const from = `import {
  users,
  scheduledShifts,
  shiftSwapRequests,
  shiftChangeRequests,
  vacations,
  locations,
  areas,
  userLocations,
  userAreas,
  positionTemplates,
  timeEntries,
  userNotifications,
  timeOffRequests,
  userMessengers,
} from "../../../db/schema.js";`;

const to = `import {
  users,
  organizations,
  scheduledShifts,
  shiftSwapRequests,
  shiftChangeRequests,
  vacations,
  locations,
  areas,
  userLocations,
  userAreas,
  positionTemplates,
  timeEntries,
  userNotifications,
  timeOffRequests,
  userMessengers,
} from "../../../db/schema.js";`;

if (content.includes("  organizations,\n")) {
  console.log("⏭  Импорт organizations уже присутствует.");
} else if (content.includes(from)) {
  content = content.replace(from, to);
  fs.writeFileSync(filePath, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("✅ Успешно: добавлен импорт organizations в users.service.ts");
} else {
  // Если форматирование чуть отличается, попробуем заменить только начало блока
  if (content.includes("import {\n  users,") && !content.includes("  organizations,")) {
      content = content.replace("import {\n  users,", "import {\n  users,\n  organizations,");
      fs.writeFileSync(filePath, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
      console.log("✅ Успешно (fallback): добавлен импорт organizations в users.service.ts");
  } else {
      console.error("❌ Не удалось найти блок импортов для замены. Проверьте файл вручную.");
  }
}