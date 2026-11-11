// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  [${label}] файл не найден`); return; }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) { console.log(`⏭  [${label}] уже применено`); return; }

  if (!normalized.includes(search)) {
    console.log(`❌ [${label}] шаблон для замены не найден`);
    return;
  }

  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  touched++;
  console.log(`✅ [${label}] применено`);
}

// ════════════════════════════════════════════════════════════
// 1. БЭКЕНД: Улучшаем функцию проверки пересечений (для ночных смен)
// ════════════════════════════════════════════════════════════
patchFile(
  "src/lib/time.ts",
  `export function shiftsOverlap(
    a: { date: string; start: string; end: string },
    b: { date: string; start: string; end: string },
): boolean {
    if (a.date !== b.date) return false;
    return a.start < b.end && b.start < a.end;
}`,
  `export function shiftsOverlap(
    a: { date: string; start: string; end: string },
    b: { date: string; start: string; end: string },
): boolean {
    if (a.date !== b.date) return false;
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    let s1 = toMins(a.start), e1 = toMins(a.end);
    let s2 = toMins(b.start), e2 = toMins(b.end);
    if (e1 <= s1) e1 += 24 * 60; // Ночная смена
    if (e2 <= s2) e2 += 24 * 60;
    return s1 < e2 && s2 < e1;
}`,
  "lib/time.ts: правильная проверка пересечений (включая ночные)"
);

// ════════════════════════════════════════════════════════════
// 2. ФРОНТЕНД: Проверка при ДОБАВЛЕНИИ смены
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WeekDetailPage.tsx",
  `        if (check.exceeds) {
          const ok = await confirmDialog(
            \`Превышение рабочей недели\\n\\n\${check.userName} уже работает \${check.currentHours} ч. Станет \${check.totalHours} ч (норма \${check.limit} ч).\\n\\nВсё равно добавить?\`,
            { title: "Превышение", confirmLabel: "Добавить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const result = await addShift({`,
  `        if (check.exceeds) {
          const ok = await confirmDialog(
            \`Превышение рабочей недели\\n\\n\${check.userName} уже работает \${check.currentHours} ч. Станет \${check.totalHours} ч (норма \${check.limit} ч).\\n\\nВсё равно добавить?\`,
            { title: "Превышение", confirmLabel: "Добавить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }

      // 🔥 Проверка пересечений смен в один день
      try {
        const overlapCheck = await shiftsApi.checkOverlap({
          userId,
          weekId: currentWeek.id,
          shiftDate: date,
          startTime,
          endTime,
        });
        if (overlapCheck.overlaps) {
          const ok = await confirmDialog(
            \`У сотрудника \${overlapCheck.userName} уже есть смена в это время (\${overlapCheck.conflicting.map((c) => \`\${c.startTime}–\${c.endTime}\`).join(", ")}).\\n\\nВсё равно добавить?\`,
            { title: "Пересечение смен", confirmLabel: "Добавить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const result = await addShift({`,
  "WeekDetailPage.tsx: проверка при добавлении смены"
);

// ════════════════════════════════════════════════════════════
// 3. ФРОНТЕНД: Проверка при РЕДАКТИРОВАНИИ смены
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WeekDetailPage.tsx",
  `function ShiftEditModal({
  shift,
  users,
  templates,
  vacations,
  sickLeaves,
  onClose,
  onUpdate,
  onDelete,
  onRequestCreated,
}: any) {`,
  `function ShiftEditModal({
  shift,
  weekId,
  users,
  templates,
  vacations,
  sickLeaves,
  onClose,
  onUpdate,
  onDelete,
  onRequestCreated,
}: any) {`,
  "WeekDetailPage.tsx: добавление weekId в пропсы модалки"
);

patchFile(
  "frontend/src/pages/WeekDetailPage.tsx",
  `  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok)
      return alertDialog(timeCheck.message ?? "Неверное время", {
        title: "Ошибка",
        variant: "error",
      });

    setBusy(true);`,
  `  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok)
      return alertDialog(timeCheck.message ?? "Неверное время", {
        title: "Ошибка",
        variant: "error",
      });

    // 🔥 Проверка пересечений при редактировании
    if (userId) {
      try {
        const overlapCheck = await shiftsApi.checkOverlap({
          userId,
          weekId,
          shiftDate,
          startTime,
          endTime,
          excludeShiftId: shift.id, // Исключаем саму редактируемую смену
        });
        if (overlapCheck.overlaps) {
          const ok = await confirmDialog(
            \`У сотрудника \${overlapCheck.userName} уже есть смена в это время (\${overlapCheck.conflicting.map((c: any) => \`\${c.startTime}–\${c.endTime}\`).join(", ")}).\\n\\nВсё равно сохранить?\`,
            { title: "Пересечение смен", confirmLabel: "Сохранить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }
    }

    setBusy(true);`,
  "WeekDetailPage.tsx: проверка при редактировании смены"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Проверка на пересечение смен добавлена.");
} else {
  console.log("⚠️ Изменений не внесено.");
}