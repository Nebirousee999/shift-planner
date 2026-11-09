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

// Ищем метод reject и полностью его заменяем
const searchBlock = `  async reject(id: string, orgId: string, reviewerId: string) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, id), eq(vacations.orgId, orgId)));
    if (!vac) throw new Error("NOT_FOUND");
    if (vac.status !== "PENDING") throw new Error("NOT_PENDING");

    const [updated] = await db
      .update(vacations)
      .set({
        startDate: vac.previousStartDate ?? vac.startDate,
        endDate: vac.previousEndDate ?? vac.endDate,
        comment: vac.previousComment ?? vac.comment,
        status: "APPROVED",
        previousStartDate: null,
        previousEndDate: null,
        previousComment: null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(vacations.id, id))
      .returning();`;

const replaceBlock = `  async reject(id: string, orgId: string, reviewerId: string) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, id), eq(vacations.orgId, orgId)));
    if (!vac) throw new Error("NOT_FOUND");
    if (vac.status !== "PENDING") throw new Error("NOT_PENDING");

    let updated;

    if (vac.previousStartDate) {
      // Это было изменение существующего отпуска — откатываем старые даты
      [updated] = await db
        .update(vacations)
        .set({
          startDate: vac.previousStartDate,
          endDate: vac.previousEndDate ?? vac.endDate,
          comment: vac.previousComment ?? vac.comment,
          status: "APPROVED",
          previousStartDate: null,
          previousEndDate: null,
          previousComment: null,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        })
        .where(eq(vacations.id, id))
        .returning();
    } else {
      // Это был новый запрос на отпуск — просто удаляем его
      await db.delete(vacations).where(eq(vacations.id, id));
      updated = vac;
    }`;

if (normalized.includes(replaceBlock)) {
  console.log("⏭  [vacations.service.ts] Логика отклонения уже исправлена.");
} else if (normalized.includes(searchBlock)) {
  normalized = normalized.replace(searchBlock, replaceBlock);
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log("✅ [vacations.service.ts] Логика отклонения обновлена (удаление новых запросов).");
} else {
  // Если точное совпадение не найдено (например, другие пробелы), делаем хитрую замену
  const regex = /async reject\(id: string, orgId: string, reviewerId: string\) \{[\s\S]*?const \[updated\] = await db[\s\S]*?\.returning\(\);/;
  if (regex.test(normalized)) {
    normalized = normalized.replace(regex, replaceBlock);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    console.log("✅ [vacations.service.ts] Логика отклонения обновлена (через Regex).");
  } else {
    console.log("❌ Не удалось найти метод reject в файле.");
  }
}