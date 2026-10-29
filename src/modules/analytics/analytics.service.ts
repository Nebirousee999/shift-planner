import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users, scheduledShifts, scheduleWeeks, timeEntries, organizations,
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

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getWeekdayIndex(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function prevMonthRange(from: string): { prevFrom: string; prevTo: string } {
  const d = new Date(from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { prevFrom: `${y}-${pad(m)}-01`, prevTo: `${y}-${pad(m)}-${pad(lastDay)}` };
}

function pctChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return round1(((current - prev) / prev) * 100);
}

export const analyticsService = {
  async summary(orgId: string, from: string, to: string, locationId?: string) {
    // 1. Получаем настройки организации
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const timeTrackingOn = org?.timeTrackingEnabled !== false;
    const mult1 = Number(org?.overtimeMultiplier1 || 1.5);
    const mult2 = Number(org?.overtimeMultiplier2 || 2.0);

    // 2. Пользователи
    const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));

    // 3. Смены за период
    const rows = await db
      .select({ shift: scheduledShifts })
      .from(scheduledShifts)
      .innerJoin(scheduleWeeks, eq(scheduledShifts.weekId, scheduleWeeks.id))
      .where(
        and(
          eq(scheduleWeeks.orgId, orgId),
          gte(scheduledShifts.shiftDate, from),
          lte(scheduledShifts.shiftDate, to),
          locationId ? eq(scheduleWeeks.locationId, locationId) : undefined
        )
      );
    const shifts = rows.map((r) => r.shift).filter((s) => s.userId && orgUserIds.has(s.userId));

    // 4. Отметки времени
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          isNotNull(timeEntries.clockIn),
          gte(timeEntries.clockIn, new Date(from + "T00:00:00Z")),
          lte(timeEntries.clockIn, new Date(to + "T23:59:59Z"))
        )
      );
    const validEntries = entries.filter((e) => orgUserIds.has(e.userId));

    // 5. Расчет
    const weekdayAgg = WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, shifts: 0, plannedHours: 0, payroll: 0 }));
    const positionAgg = new Map<string, { shifts: number; plannedHours: number; payroll: number }>();

    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let totalPlannedPayroll = 0;
    let totalActualPayroll = 0;
    let totalOvertimeCost = 0;
    let unassignedShifts = 0;
    
    // Дисциплина
    let lateCount = 0;
    let earlyCount = 0;
    let noShowCount = 0;
    const disciplineFeed: any[] = [];

    const userStats = orgUsers.map((u) => {
      const userShifts = shifts.filter((s) => s.userId === u.id);
      const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
      const isMonthly = u.paymentType === "MONTHLY";

      const plannedHours = userShifts.reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0);
      
      // Фактические часы
      let actualHours = 0;
      let userOvertimeCost = 0;

      for (const s of userShifts) {
        const dateStr = String(s.shiftDate).slice(0, 10);
        const sHours = hoursBetween(s.startTime, s.endTime);
        
        let factHoursForDay = 0;
        if (timeTrackingOn) {
          const entry = validEntries.find((e) => e.shiftId === s.id);
          if (entry && entry.clockIn && entry.clockOut) {
            factHoursForDay = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 3600000;
          } else if (dateStr < new Date().toISOString().slice(0, 10)) {
            factHoursForDay = sHours; // Если время выключено или нет отметки, а смена прошла — считаем по плану
          }
        } else {
          // Тайм-трекинг выключен — факт равен плану для прошедших смен
          if (dateStr <= new Date().toISOString().slice(0, 10)) {
            factHoursForDay = sHours;
          }
        }

        actualHours += factHoursForDay;

        // Переработка по дням (если факт > план)
        if (factHoursForDay > sHours) {
          const diff = factHoursForDay - sHours;
          const firstTwo = Math.min(diff, 2);
          const rest = Math.max(diff - 2, 0);
          userOvertimeCost += (firstTwo * rate * mult1) + (rest * rate * mult2);
        }

        // Дисциплина
        if (s.isNoShow) {
          noShowCount++;
          disciplineFeed.push({ date: dateStr, userName: u.name, position: u.position, type: "Прогул", minutes: 0 });
        } else {
          if (s.latenessMinutes && s.latenessMinutes > 0) {
            lateCount++;
            disciplineFeed.push({ date: dateStr, userName: u.name, position: u.position, type: "Опоздание", minutes: s.latenessMinutes });
          }
          if (s.earlyLeaveMinutes && s.earlyLeaveMinutes > 0) {
            earlyCount++;
            disciplineFeed.push({ date: dateStr, userName: u.name, position: u.position, type: "Ранний уход", minutes: s.earlyLeaveMinutes });
          }
        }
      }

      // ФОТ
      const plannedPayroll = isMonthly ? rate : (rate * plannedHours);
      const actualPayroll = isMonthly ? rate : (rate * actualHours);

      totalPlannedHours += plannedHours;
      totalActualHours += actualHours;
      totalPlannedPayroll += plannedPayroll;
      totalActualPayroll += actualPayroll;
      totalOvertimeCost += userOvertimeCost;

      // Группировка по должностям
      const positionKey = u.position?.trim() || "Без должности";
      if (!positionAgg.has(positionKey)) {
        positionAgg.set(positionKey, { shifts: 0, plannedHours: 0, payroll: 0 });
      }
      const posAgg = positionAgg.get(positionKey)!;

      for (const s of userShifts) {
        const h = hoursBetween(s.startTime, s.endTime);
        const pay = isMonthly ? 0 : h * rate; // Для окладников не суммируем часы в ФОТ должности
        const wi = getWeekdayIndex(String(s.shiftDate).slice(0, 10));
        if (weekdayAgg[wi]) {
          weekdayAgg[wi].shifts++;
          weekdayAgg[wi].plannedHours += h;
          weekdayAgg[wi].payroll += pay;
        }
        posAgg.shifts++;
        posAgg.plannedHours += h;
        posAgg.payroll += pay;
      }

      return {
        userId: u.id, name: u.name, role: u.role,
        hourlyRate: rate || null, paymentType: u.paymentType,
        shiftsCount: userShifts.length,
        plannedHours: round1(plannedHours), actualHours: round1(actualHours),
        plannedPayroll: Math.round(plannedPayroll), actualPayroll: Math.round(actualPayroll),
        overtimeCost: Math.round(userOvertimeCost),
      };
    });

    // Не назначенные смены
    unassignedShifts = shifts.filter((s) => !s.userId).length;

    // MoM (предыдущий месяц)
    const { prevFrom, prevTo } = prevMonthRange(from);
    // Упрощенный расчет MoM (чтобы не дублировать код, можно вынести в функцию, но для краткости просто пересчитаем суммы)
    const prevRows = await db.select({ shift: scheduledShifts }).from(scheduledShifts)
      .innerJoin(scheduleWeeks, eq(scheduledShifts.weekId, scheduleWeeks.id))
      .where(and(eq(scheduleWeeks.orgId, orgId), gte(scheduledShifts.shiftDate, prevFrom), lte(scheduledShifts.shiftDate, prevTo), locationId ? eq(scheduleWeeks.locationId, locationId) : undefined));
    const prevShifts = prevRows.map(r => r.shift).filter(s => s.userId && orgUserIds.has(s.userId));
    
    let prevHours = 0;
    let prevPayroll = 0;
    for (const u of orgUsers) {
      const uShifts = prevShifts.filter(s => s.userId === u.id);
      const h = uShifts.reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0);
      prevHours += h;
      prevPayroll += (u.paymentType === "MONTHLY" ? Number(u.hourlyRate || 0) : (h * Number(u.hourlyRate || 0)));
    }

    const mom = {
      hours: pctChange(totalPlannedHours, prevHours),
      payroll: pctChange(totalPlannedPayroll, prevPayroll),
      actualPayroll: pctChange(totalActualPayroll, prevPayroll), // Грубое сравнение
      avgCost: 0,
    };

    return {
      period: { from, to },
      prevPeriod: { from: prevFrom, to: prevTo },
      timeTrackingOn,
      totals: {
        hours: round1(totalPlannedHours),
        shifts: shifts.length,
        payroll: Math.round(totalPlannedPayroll),
        actualPayroll: Math.round(totalActualPayroll),
        overtimeCost: Math.round(totalOvertimeCost),
        avgCost: shifts.length > 0 ? Math.round(totalPlannedPayroll / shifts.length) : 0,
        unassignedShifts,
        mom,
      },
      users: userStats.filter(u => u.shiftsCount > 0 || u.actualHours > 0).sort((a, b) => b.plannedHours - a.plannedHours),
      planVsFact: {
        plannedHours: round1(totalPlannedHours),
        actualHours: round1(totalActualHours),
        diffPercent: totalPlannedHours > 0 ? round1(((totalActualHours - totalPlannedHours) / totalPlannedHours) * 100) : 0,
      },
      byWeekday: weekdayAgg.map(w => ({ ...w, plannedHours: round1(w.plannedHours), payroll: Math.round(w.payroll) })),
      byPosition: Array.from(positionAgg.entries()).map(([pos, agg]) => ({
        position: pos, shifts: agg.shifts, plannedHours: round1(agg.plannedHours), payroll: Math.round(agg.payroll),
        percent: totalPlannedPayroll > 0 ? round1((agg.payroll / totalPlannedPayroll) * 100) : 0
      })).sort((a, b) => b.payroll - a.payroll),
      discipline: {
        late: lateCount, early: earlyCount, noShow: noShowCount,
        feed: disciplineFeed.sort((a, b) => b.date.localeCompare(a.date))
      }
    };
  },
};