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

// ═══════════════════════════════════════════════════════════════
// 1. Очистка уведомлений в колокольчике при одобрении/отклонении
// ═══════════════════════════════════════════════════════════════

// Отгулы
patchFile(
  "src/modules/time-off/time-off.service.ts",
  `    await messengerService.sendToUser(req.userId, \`<b>Отгул одобрен</b>\\n\\nВаш запрос на отгул на \${req.date} одобрен. Смена снята.\`);`,
  `    await notificationsService.resolveActionable(id, "time_off_request", "APPROVED", reviewer?.name ?? "Руководитель", \`отгул на \${req.date} одобрен, смена снята\`);\n    await messengerService.sendToUser(req.userId, \`<b>Отгул одобрен</b>\\n\\nВаш запрос на отгул на \${req.date} одобрен. Смена снята.\`);`,
  "time-off.service.ts (resolveActionable при одобрении)"
);
patchFile(
  "src/modules/time-off/time-off.service.ts",
  `    await messengerService.sendToUser(req.userId, \`<b>Отгул отклонён</b>\\n\\nЗапрос на \${req.date} отклонён.\`);`,
  `    await notificationsService.resolveActionable(id, "time_off_request", "REJECTED", reviewer?.name ?? "Руководитель", \`отгул на \${req.date} отклонён\`);\n    await messengerService.sendToUser(req.userId, \`<b>Отгул отклонён</b>\\n\\nЗапрос на \${req.date} отклонён.\`);`,
  "time-off.service.ts (resolveActionable при отклонении)"
);

// Отпуска
patchFile(
  "src/modules/vacations/vacations.service.ts",
  `    await notificationsService.create({\n      orgId,\n      userId: vac.userId,\n      kind: "VACATION_APPROVED",`,
  `    await notificationsService.resolveActionable(id, "vacation_request", "APPROVED", reviewer?.name ?? "Руководитель", \`отпуск одобрен\`);\n    await notificationsService.create({\n      orgId,\n      userId: vac.userId,\n      kind: "VACATION_APPROVED",`,
  "vacations.service.ts (resolveActionable при одобрении)"
);
patchFile(
  "src/modules/vacations/vacations.service.ts",
  `    await notificationsService.create({\n      orgId,\n      userId: vac.userId,\n      kind: "VACATION_REJECTED",`,
  `    await notificationsService.resolveActionable(id, "vacation_request", "REJECTED", reviewer?.name ?? "Руководитель", \`отпуск отклонён\`);\n    await notificationsService.create({\n      orgId,\n      userId: vac.userId,\n      kind: "VACATION_REJECTED",`,
  "vacations.service.ts (resolveActionable при отклонении)"
);

// Обмены сменами
patchFile(
  "src/modules/swaps/swaps.service.ts",
  `    if (req.requestedBy !== userId) {\n      await notificationsService.create({\n        orgId,\n        userId: req.requestedBy,\n        kind: "SWAP_ACCEPTED",`,
  `    await notificationsService.resolveActionable(id, "swap_request", "APPROVED", accepter?.name ?? "Сотрудник", \`обмен смены на \${shiftDateStr} принят\`);\n    if (req.requestedBy !== userId) {\n      await notificationsService.create({\n        orgId,\n        userId: req.requestedBy,\n        kind: "SWAP_ACCEPTED",`,
  "swaps.service.ts (resolveActionable при принятии)"
);
patchFile(
  "src/modules/swaps/swaps.service.ts",
  `    if (req.requestedBy !== userId) {\n      await notificationsService.create({\n        orgId,\n        userId: req.requestedBy,\n        kind: "SWAP_DECLINED",`,
  `    await notificationsService.resolveActionable(id, "swap_request", "REJECTED", decliner?.name ?? "Сотрудник", \`обмен смены на \${shiftDateStr} отклонён\`);\n    if (req.requestedBy !== userId) {\n      await notificationsService.create({\n        orgId,\n        userId: req.requestedBy,\n        kind: "SWAP_DECLINED",`,
  "swaps.service.ts (resolveActionable при отклонении)"
);

// Изменения смен
patchFile(
  "src/modules/shift-change-requests/shift-change-requests.service.ts",
  `      await notificationsService.create({\n        orgId: req.orgId,\n        userId: req.requestedBy,\n        kind: "SHIFT_CHANGE_APPROVED",`,
  `      await notificationsService.resolveActionable(id, "shift_change_request", "APPROVED", resolver?.name ?? "Сотрудник", \`смена изменена\`);\n      await notificationsService.create({\n        orgId: req.orgId,\n        userId: req.requestedBy,\n        kind: "SHIFT_CHANGE_APPROVED",`,
  "shift-change-requests.service.ts (resolveActionable при одобрении)"
);
patchFile(
  "src/modules/shift-change-requests/shift-change-requests.service.ts",
  `    await notificationsService.create({\n      orgId: req.orgId,\n      userId: req.requestedBy,\n      kind: "SHIFT_CHANGE_REJECTED",`,
  `    await notificationsService.resolveActionable(id, "shift_change_request", "REJECTED", resolver?.name ?? "Сотрудник", \`смена отклонена\`);\n    await notificationsService.create({\n      orgId: req.orgId,\n      userId: req.requestedBy,\n      kind: "SHIFT_CHANGE_REJECTED",`,
  "shift-change-requests.service.ts (resolveActionable при отклонении)"
);


// ═══════════════════════════════════════════════════════════════
// 2. Оранжевые точки на странице "Недели" (из предыдущего патча)
// ═══════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `import { useOrganization } from "../store/organization";`,
  `import { useOrganization } from "../store/organization";\nimport { useTimeOff } from "../store/timeOff";`,
  "WeeksPage.tsx (импорт useTimeOff)"
);
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `  const { items: positions, fetch: fetchPositions } = usePositions();`,
  `  const { items: positions, fetch: fetchPositions } = usePositions();\n  const { items: timeOffs, fetch: fetchTimeOffs } = useTimeOff();`,
  "WeeksPage.tsx (хук useTimeOff)"
);
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `    fetchAreas();\n    fetchPositions();\n    Promise.all([`,
  `    fetchAreas();\n    fetchPositions();\n    fetchTimeOffs();\n    Promise.all([`,
  "WeeksPage.tsx (вызов fetchTimeOffs)"
);
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `  // ═════════════════════════════════════════════════════════\n  // СВОДКА: только активная точка`,
  `  useEffect(() => {
    if (timeOffs.length > 0) {
      setPendingDates((prev) => {
        const next = new Set(prev);
        for (const t of timeOffs) {
          if (t.status === "PENDING") {
            next.add(String(t.date).slice(0, 10));
          }
        }
        return next;
      });
    }
  }, [timeOffs]);

  // ═════════════════════════════════════════════════════════
  // СВОДКА: только активная точка`,
  "WeeksPage.tsx (добавлен useEffect для отгулов)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}