import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. Бэкенд: умное удаление/отмена отпуска
patchFile(
  "src/modules/vacations/vacations.service.ts",
  `        await db.delete(vacations).where(eq(vacations.id, input.id));
        await notificationsService.dismissActionable(input.id, "vacation_request");
        return { success: true };
      },`,
  `        if (vac.status === "PENDING") {
          if (vac.previousStartDate) {
            // Это было изменение отпуска — откатываем старые даты
            await db
              .update(vacations)
              .set({
                startDate: vac.previousStartDate,
                endDate: vac.previousEndDate ?? vac.endDate,
                comment: vac.previousComment ?? vac.comment,
                status: "APPROVED",
                previousStartDate: null,
                previousEndDate: null,
                previousComment: null,
              })
              .where(eq(vacations.id, input.id));
          } else {
            // Это был новый запрос — просто удаляем
            await db.delete(vacations).where(eq(vacations.id, input.id));
          }
        } else {
          // Обычное удаление одобренного отпуска
          await db.delete(vacations).where(eq(vacations.id, input.id));
        }

        await notificationsService.dismissActionable(input.id, "vacation_request");
        return { success: true };
      },`,
  "vacations.service.ts (умная отмена pending-запросов)"
);

// 2. Фронтенд: добавление иконки Undo2 в импорты
patchFile(
  "frontend/src/pages/MySchedulePage.tsx",
  `  Pencil, Bell, CalendarX2, Stethoscope
} from "lucide-react";`,
  `  Pencil, Bell, CalendarX2, Stethoscope, Undo2
} from "lucide-react";`,
  "MySchedulePage.tsx (добавлен Undo2)"
);

// 3. Фронтенд: замена кнопки удаления на отмену, если есть статус PENDING
patchFile(
  "frontend/src/pages/MySchedulePage.tsx",
  `                        <button onClick={() => onDeleteVacation(v.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Удалить"><X className="w-3.5 h-3.5" /></button>`,
  `                        {isPending ? (
                          <button onClick={() => onDeleteVacation(v.id)} className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition-colors" title="Отменить запрос"><Undo2 className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => onDeleteVacation(v.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Удалить"><X className="w-3.5 h-3.5" /></button>
                        )}`,
  "MySchedulePage.tsx (кнопка отмены для PENDING)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}