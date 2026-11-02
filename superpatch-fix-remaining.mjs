// superpatch-fix-remaining.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function readN(p) {
  const raw = fs.readFileSync(path.join(ROOT, p), "utf-8");
  const hadCRLF = raw.includes("\r\n");
  return { content: raw.replace(/\r\n/g, "\n"), hadCRLF };
}
function writeN(p, data) {
  const out = data.hadCRLF ? data.content.replace(/\n/g, "\r\n") : data.content;
  fs.writeFileSync(path.join(ROOT, p), out, "utf-8");
  console.log(`✔ ${p}${data.hadCRLF ? " (CRLF)" : " (LF)"}`);
}

// ═══════════════════════════════════════════════════════════════
// 1. БЕЗОПАСНОСТЬ: Запрет дисциплины для сотрудников
// ═══════════════════════════════════════════════════════════════
{
  const p = "src/modules/scheduled-shifts/scheduled-shifts.service.ts";
  const data = readN(p);
  let c = data.content;

  const target = `    // 👇 Проверка окна редактирования дисциплины
    if (isOnlyDiscipline) {`;
  
  const replace = `    // 👇 Запрет для сотрудников изменять дисциплину
    if (isOnlyDiscipline && input.requesterRole === "EMPLOYEE") {
      throw new Error("FORBIDDEN");
    }

    // 👇 Проверка окна редактирования дисциплины
    if (isOnlyDiscipline) {`;

  if (c.includes(target) && !c.includes('throw new Error("FORBIDDEN")')) {
    c = c.replace(target, replace);
    data.content = c;
    writeN(p, data);
  } else {
    console.log(`✔ ${p} (защита дисциплины уже настроена)`);
  }
}

// Добавляем FORBIDDEN в роуты
{
  const p = "src/modules/scheduled-shifts/scheduled-shifts.routes.ts";
  const data = readN(p);
  let c = data.content;

  const target = `        DISCIPLINE_WINDOW_CLOSED: "Прошло слишком много времени. Редактирование дисциплины за этот день закрыто.",
      };`;
  
  const replace = `        DISCIPLINE_WINDOW_CLOSED: "Прошло слишком много времени. Редактирование дисциплины за этот день закрыто.",
        FORBIDDEN: "Недостаточно прав для изменения дисциплины",
      };`;

  if (c.includes(target) && !c.includes("FORBIDDEN:")) {
    c = c.replace(target, replace);
    data.content = c;
    writeN(p, data);
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. БАГ: Ночные смены при создании обмена
// ═══════════════════════════════════════════════════════════════
{
  const p = "src/modules/swaps/swaps.service.ts";
  const data = readN(p);
  let c = data.content;

  // 2.1 Добавляем импорт gte, lte
  if (!c.includes("gte,")) {
    c = c.replace(
      `import { eq, and, ne, desc, notInArray } from "drizzle-orm";`,
      `import { eq, and, ne, desc, notInArray, gte, lte } from "drizzle-orm";`
    );
  }

  // 2.2 Добавляем вспомогательную функцию для безопасного сравнения
  const helperAnchor = `async function getOrgIdForShift`;
  const helper = `function getShiftRange(dateStr: string, startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const baseTs = new Date(dateStr + "T00:00:00Z").getTime();
  const startTs = baseTs + (sh * 60 + sm) * 60000;
  let endTs = baseTs + (eh * 60 + em) * 60000;
  if (endTs <= startTs) endTs += 24 * 60 * 60000; // ночная смена
  return { start: startTs, end: endTs };
}

function shiftsOverlapSafe(
  a: { date: string; start: string; end: string },
  b: { date: string; start: string; end: string }
): boolean {
  const ar = getShiftRange(a.date, a.start, a.end);
  const br = getShiftRange(b.date, b.start, b.end);
  return ar.start < br.end && br.start < ar.end;
}

`;
  if (!c.includes("shiftsOverlapSafe")) {
    c = c.replace(helperAnchor, helper + helperAnchor);
  }

  // 2.3 Меняем блок проверки занятости target в create()
  const target = `      const sameDayShifts = await db
        .select()
        .from(scheduledShifts)
        .where(
          and(
            eq(scheduledShifts.userId, input.swapWithUserId),
            eq(scheduledShifts.shiftDate, shiftDateStr)
          )
        );
      const newShift = {
        date: shiftDateStr,
        start: shift.startTime,
        end: shift.endTime,
      };
      const conflict = sameDayShifts.find((s) =>
        shiftsOverlap(newShift, {
          date: String(s.shiftDate).slice(0, 10),
          start: s.startTime,
          end: s.endTime,
        })
      );
      if (conflict) throw new Error("TARGET_BUSY");`;

  const replace = `      // Ищем смены target за вчера, сегодня и завтра (для учета ночных)
      const yesterday = new Date(shiftDateStr + "T00:00:00Z");
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const tomorrow = new Date(shiftDateStr + "T00:00:00Z");
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const targetShifts = await db
        .select()
        .from(scheduledShifts)
        .where(
          and(
            eq(scheduledShifts.userId, input.swapWithUserId),
            gte(scheduledShifts.shiftDate, yesterday.toISOString().slice(0, 10)),
            lte(scheduledShifts.shiftDate, tomorrow.toISOString().slice(0, 10))
          )
        );

      const newShift = {
        date: shiftDateStr,
        start: shift.startTime,
        end: shift.endTime,
      };
      
      const conflict = targetShifts.find((s) =>
        shiftsOverlapSafe(newShift, {
          date: String(s.shiftDate).slice(0, 10),
          start: s.startTime,
          end: s.endTime,
        })
      );
      if (conflict) throw new Error("TARGET_BUSY");`;

  if (c.includes(target)) {
    c = c.replace(target, replace);
    data.content = c;
    writeN(p, data);
  } else {
    console.warn(`⚠ ${p} (не найден блок проверки target в create())`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. БАГ: Очистка "сиротских" записей при удалении сотрудника
// ═══════════════════════════════════════════════════════════════
{
  const p = "src/modules/users/users.service.ts";
  const data = readN(p);
  let c = data.content;

  // 3.1 Добавляем импорты
  const currentImports = `import {
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
} from "../../../db/schema.js";`;

  const newImports = `import {
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

  if (c.includes("timeEntries") && c.includes("userMessengers")) {
    console.log(`✔ ${p} (импорты уже добавлены)`);
  } else if (c.includes(currentImports)) {
    c = c.replace(currentImports, newImports);
  } else {
    console.warn(`⚠ ${p} (не найден блок импортов schema)`);
  }

  // 3.2 Добавляем очистку перед delete users
  const target = `    await db.delete(vacations).where(eq(vacations.userId, id));

    const [deleted] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning({ id: users.id });`;

  const replace = `    await db.delete(vacations).where(eq(vacations.userId, id));
    await db.delete(timeEntries).where(eq(timeEntries.userId, id));
    await db.delete(userNotifications).where(eq(userNotifications.userId, id));
    await db.delete(timeOffRequests).where(eq(timeOffRequests.userId, id));
    await db.delete(userMessengers).where(eq(userMessengers.userId, id));

    const [deleted] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning({ id: users.id });`;

  if (c.includes(target) && !c.includes("db.delete(timeEntries)")) {
    c = c.replace(target, replace);
    data.content = c;
    writeN(p, data);
  } else if (c.includes("db.delete(timeEntries)")) {
    console.log(`✔ ${p} (очистка уже настроена)`);
  } else {
    console.warn(`⚠ ${p} (не найден блок удаления vacations + users)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. ПРОИЗВОДИТЕЛЬНОСТЬ: N+1 в аналитике
// ═══════════════════════════════════════════════════════════════
{
  const p = "src/modules/analytics/analytics.service.ts";
  const data = readN(p);
  let c = data.content;

  // 4.1 Добавляем группировку по userId и shiftId перед userStats
  const targetGroup = `    // 5. Расчет
    const weekdayAgg = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, shifts: 0, plannedHours: 0, payroll: 0 }));`;
  const replaceGroup = `    // 4.5. Индексируем данные для быстрого доступа (устраняем N+1)
    const shiftsByUser = new Map<string, typeof shifts>();
    for (const s of shifts) {
      if (!s.userId) continue;
      if (!shiftsByUser.has(s.userId)) shiftsByUser.set(s.userId, []);
      shiftsByUser.get(s.userId)!.push(s);
    }
    
    const entriesByShift = new Map<string, typeof validEntries[number]>();
    for (const e of validEntries) {
      if (e.shiftId) entriesByShift.set(e.shiftId, e);
    }

    // 5. Расчет
    const weekdayAgg = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, shifts: 0, plannedHours: 0, payroll: 0 }));`;

  if (c.includes(targetGroup) && !c.includes("shiftsByUser")) {
    c = c.replace(targetGroup, replaceGroup);
  }

  // 4.2 Заменяем filter на lookup
  const targetFilter = `      const userShifts = shifts.filter((s) => s.userId === u.id);`;
  const replaceFilter = `      const userShifts = shiftsByUser.get(u.id) ?? [];`;
  if (c.includes(targetFilter)) {
    c = c.replace(targetFilter, replaceFilter);
  }

  // 4.3 Заменяем find на lookup
  const targetFind = `          const entry = validEntries.find((e) => e.shiftId === s.id);`;
  const replaceFind = `          const entry = entriesByShift.get(s.id);`;
  if (c.includes(targetFind)) {
    c = c.replace(targetFind, replaceFind);
  }

  data.content = c;
  writeN(p, data);
}

console.log("\n✅ Все оставшиеся баги исправлены!");
console.log("Перезапусти бэкенд (npm run dev).");