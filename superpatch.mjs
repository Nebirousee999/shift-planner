import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "src/modules/vacations/vacations.service.ts");

if (!fs.existsSync(filePath)) {
  console.log("❌ Файл vacations.service.ts не найден!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const hadCRLF = content.includes("\r\n");
let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

// Умная замена всего метода remove
const regex = /async remove\(input: \{[\s\S]*?return \{ success: true \};\s*\}/;

const newRemove = `async remove(input: {
    id: string;
    orgId: string;
    requesterId: string;
    requesterRole: string;
  }) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, input.id), eq(vacations.orgId, input.orgId)));
    if (!vac) throw new Error("NOT_FOUND");

    const isAdmin =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    if (!isAdmin && vac.userId !== input.requesterId) {
      throw new Error("FORBIDDEN");
    }

    if (vac.status === "PENDING") {
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
  }`;

if (normalized.includes('if (vac.status === "PENDING") {\n      if (vac.previousStartDate) {')) {
  console.log("⏭  [vacations.service.ts] Метод remove уже исправлен.");
} else if (regex.test(normalized)) {
  normalized = normalized.replace(regex, newRemove);
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log("✅ [vacations.service.ts] Метод remove успешно переписан (умная отмена).");
} else {
  console.log("❌ Не удалось найти метод remove для замены. Придется поправить вручную.");
}