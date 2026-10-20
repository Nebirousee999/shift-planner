import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { 
  scheduledShifts, 
  timeEntries, 
  users, 
  organizations,
  shiftChangeRequests // <--- Добавили импорт
} from "../../../db/schema.js";

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const overtimeService = {
  async calculateForPeriod(orgId: string, from: string, to: string) {
    // 1. Настройки коэффициентов
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const mult1 = Number(org?.overtimeMultiplier1 || 1.5);
    const mult2 = Number(org?.overtimeMultiplier2 || 2.0);

    // 2. Список сотрудников
    const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));

    // 3. Запрашиваем смены
    const shifts = await db.select().from(scheduledShifts).where(
      and(
        gte(scheduledShifts.shiftDate, from),
        lte(scheduledShifts.shiftDate, to),
        isNotNull(scheduledShifts.userId)
      )
    );
    const validShifts = shifts.filter(s => s.userId && orgUserIds.has(s.userId));

    // 4. Запрашиваем фактические отметки (clock-in/out)
    const entries = await db.select().from(timeEntries).where(
      and(
        isNotNull(timeEntries.clockIn),
        isNotNull(timeEntries.clockOut),
        gte(timeEntries.clockIn, new Date(from + "T00:00:00Z")),
        lte(timeEntries.clockIn, new Date(to + "T23:59:59Z"))
      )
    );
    const validEntries = entries.filter(e => orgUserIds.has(e.userId));

    // 5. ЗАПРАШИВАЕМ ОДОБРЕННЫЕ ЗАПРОСЫ НА ИЗМЕНЕНИЕ СМЕН
    const changeRequests = await db.select().from(shiftChangeRequests).where(
      and(
        eq(shiftChangeRequests.orgId, orgId),
        eq(shiftChangeRequests.status, "APPROVED"),
        gte(shiftChangeRequests.newShiftDate, from),
        lte(shiftChangeRequests.newShiftDate, to)
      )
    );
    // Делаем карту для быстрого поиска: shiftId -> request
    const reqMap = new Map(changeRequests.map(r => [r.shiftId, r]));

    // 6. Считаем переработку
    const result = orgUsers.map((user) => {
      let totalPlannedHours = 0;
      let totalActualHours = 0;
      let overtimeHours = 0;
      let overtimePay = 0;

      const rate = user.hourlyRate ? Number(user.hourlyRate) : 0;
      const userShifts = validShifts.filter((s) => s.userId === user.id);
      const userEntries = validEntries.filter((e) => e.userId === user.id);
      
      const days: Record<string, { planned: number; actual: number }> = {};

      // Проходим по каждой смене
      for (const s of userShifts) {
        const dateStr = String(s.shiftDate).slice(0, 10);
        if (!days[dateStr]) days[dateStr] = { planned: 0, actual: 0 };

        // Проверяем, был ли запрос на изменение этой смены
        const req = reqMap.get(s.id);
        
        // Если запрос был — План = старое время, иначе План = текущее время смены
        const originalStart = req ? req.oldStartTime : s.startTime;
        const originalEnd = req ? req.oldEndTime : s.endTime;
        
        days[dateStr].planned += hoursBetween(originalStart, originalEnd);

        // Теперь смотрим Факт:
        // Если есть отметка clock-in/out — берем её
        const entry = userEntries.find(e => e.shiftId === s.id);
        if (entry && entry.clockIn && entry.clockOut) {
          const actualHours = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 3600000;
          days[dateStr].actual += actualHours;
        } else {
          // Если отметок нет — берем текущее (уже одобренное) время смены
          days[dateStr].actual += hoursBetween(s.startTime, s.endTime);
        }
      }

      // Считаем переработку по дням
      for (const date in days) {
        const planned = days[date].planned;
        const actual = days[date].actual;

        totalPlannedHours += planned;
        totalActualHours += actual;

        // Если факт превышает изначальный план (смену продлили)
        if (actual > planned) {
          const diff = actual - planned;
          overtimeHours += diff;
          
          const firstTwo = Math.min(diff, 2);
          const rest = Math.max(diff - 2, 0);
          overtimePay += (firstTwo * rate * mult1) + (rest * rate * mult2);
        }
      }

      return {
        userId: user.id,
        name: user.name,
        hourlyRate: rate,
        plannedHours: round1(totalPlannedHours),
        actualHours: round1(totalActualHours),
        overtimeHours: round1(overtimeHours),
        overtimePay: Math.round(overtimePay),
      };
    });

    return {
      period: { from, to },
      settings: { mult1, mult2 },
      users: result.filter((u) => u.plannedHours > 0 || u.actualHours > 0),
    };
  },
};