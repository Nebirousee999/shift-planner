import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "src/modules/swaps/swaps.service.ts");

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, "utf-8");
  
  if (content.includes('await notificationsService.dismissActionable(id, "swap_request");')) {
    console.log("⏭  [swaps.service.ts] Уже исправлено.");
  } else {
    // Находим удаление заявки и добавляем удаление уведомления сразу после него
    content = content.replace(
      /(await db\.delete\(shiftSwapRequests\)\.where\(eq\(shiftSwapRequests\.id, id\)\);)/,
      `$1\n    await notificationsService.dismissActionable(id, "swap_request");`
    );
    
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("✅ [swaps.service.ts] Очистка уведомлений при отмене обмена успешно добавлена.");
  }
} else {
  console.log("❌ Файл swaps.service.ts не найден.");
}