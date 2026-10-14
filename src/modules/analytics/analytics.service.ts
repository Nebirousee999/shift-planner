import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users,
  scheduledShifts,
  scheduleWeeks,
  timeEntries,
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

export const analyticsService = {
  async summary(orgId: string, from: string, to: string) {
    // Все сотрудники организации
    const orgUsers = await db
      .select()
      .from(users)
      .where(eq(users.orgId, orgId));

    if (orgUsers.length === 0) {
      return {
        period: { from, to },
        totals: { hours: 0, shifts: 0, payroll: 0 },
        users: [],
        planVsFact: { plannedHours: 0, actualHours: 0, diffPercent: 0 },
      };
    }

    // Смены за период
    const allShifts = await db
      .select()
      .from(scheduledShifts)
      .where(
        and(
          gte(scheduledShifts.shiftDate, from),
          lte(scheduledShifts.shiftDate, to)
        )
      );

    // Фильтруем только смены сотрудников этой организации
    const orgUserIds = new Set(orgUsers.map((u) => u.id));
    const shifts = allShifts.filter(
      (s) => s.userId && orgUserIds.has(s.userId)
    );

    // Часы за период
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          isNotNull(timeEntries.clockIn),
          isNotNull(timeEntries.clockOut),
          gte(timeEntries.clockIn, new Date(from + "T00:00:00Z")),
          lte(timeEntries.clockIn, new Date(to + "T23:59:59Z"))
        )
      );

    const orgEntries = entries.filter((e) => orgUserIds.has(e.userId));

    // По каждому сотруднику
    const userStats = orgUsers.map((u) => {
      const userShifts = shifts.filter((s) => s.userId === u.id);
      const plannedHours = userShifts.reduce(
        (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
        0
      );

      const userEntries = orgEntries.filter((e) => e.userId === u.id);
      const actualHours = userEntries.reduce((sum, e) => {
        const ms =
          new Date(e.clockOut!).getTime() - new Date(e.clockIn!).getTime();
        return sum + ms / 3600000;
      }, 0);

      const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
      const payroll = rate * plannedHours;

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        hourlyRate: rate || null,
        shiftsCount: userShifts.length,
        plannedHours: round1(plannedHours),
        actualHours: round1(actualHours),
        payroll: Math.round(payroll),
      };
    });

    const totals = userStats.reduce(
      (acc, u) => ({
        hours: acc.hours + u.plannedHours,
        shifts: acc.shifts + u.shiftsCount,
        payroll: acc.payroll + u.payroll,
      }),
      { hours: 0, shifts: 0, payroll: 0 }
    );

    const totalPlanned = totals.hours;
    const totalActual = userStats.reduce((s, u) => s + u.actualHours, 0);
    const diffPercent =
      totalPlanned > 0
        ? round1(((totalActual - totalPlanned) / totalPlanned) * 100)
        : 0;

    return {
      period: { from, to },
      totals: {
        hours: round1(totals.hours),
        shifts: totals.shifts,
        payroll: totals.payroll,
      },
      users: userStats
        .filter((u) => u.shiftsCount > 0 || u.actualHours > 0)
        .sort((a, b) => b.plannedHours - a.plannedHours),
      planVsFact: {
        plannedHours: round1(totalPlanned),
        actualHours: round1(totalActual),
        diffPercent,
      },
    };
  },
};