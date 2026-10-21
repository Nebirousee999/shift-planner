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
    const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));

    if (orgUsers.length === 0) {
      return {
        period: { from, to },
        totals: { hours: 0, shifts: 0, payroll: 0, actualPayroll: 0, overtimeCost: 0 },
        users: [],
        planVsFact: { plannedHours: 0, actualHours: 0, diffPercent: 0 },
      };
    }

    const allShifts = await db
      .select()
      .from(scheduledShifts)
      .where(
        and(
          gte(scheduledShifts.shiftDate, from),
          lte(scheduledShifts.shiftDate, to)
        )
      );

    const orgUserIds = new Set(orgUsers.map((u) => u.id));
    const shifts = allShifts.filter((s) => s.userId && orgUserIds.has(s.userId));

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

    const orgEntries = entries.filter((e) => orgUserIds.has(e.userId));

    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let totalPlannedPayroll = 0;
    let totalActualPayroll = 0;
    let totalOvertimeCost = 0;

    const userStats = orgUsers.map((u) => {
      const userShifts = shifts.filter((s) => s.userId === u.id);
      const plannedHours = userShifts.reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0);

      const userEntries = orgEntries.filter((e) => e.userId === u.id);
      const actualHours = userEntries.reduce((sum, e) => {
        const end = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
        const start = new Date(e.clockIn!).getTime();
        return sum + (end - start) / 3600000;
      }, 0);

      const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
      const plannedPayroll = rate * plannedHours;
      const actualPayroll = rate * actualHours;

      // Считаем переработку (всё, что свыше 160 часов в месяц, берем с коэфф. 1.5)
      const overtimeHours = Math.max(0, actualHours - 160);
      const overtimeCost = overtimeHours * rate * 1.5;

      totalPlannedHours += plannedHours;
      totalActualHours += actualHours;
      totalPlannedPayroll += plannedPayroll;
      totalActualPayroll += actualPayroll;
      totalOvertimeCost += overtimeCost;

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        hourlyRate: rate || null,
        shiftsCount: userShifts.length,
        plannedHours: round1(plannedHours),
        actualHours: round1(actualHours),
        plannedPayroll: Math.round(plannedPayroll),
        actualPayroll: Math.round(actualPayroll),
        overtimeHours: round1(overtimeHours),
        overtimeCost: Math.round(overtimeCost),
      };
    });

    const diffPercent =
      totalPlannedHours > 0
        ? round1(((totalActualHours - totalPlannedHours) / totalPlannedHours) * 100)
        : 0;

    return {
      period: { from, to },
      totals: {
        hours: round1(totalPlannedHours),
        shifts: shifts.length,
        payroll: Math.round(totalPlannedPayroll),
        actualPayroll: Math.round(totalActualPayroll),
        overtimeCost: Math.round(totalOvertimeCost),
        avgCost: shifts.length > 0 ? Math.round(totalPlannedPayroll / shifts.length) : 0,
      },
      users: userStats
        .filter((u) => u.shiftsCount > 0 || u.actualHours > 0)
        .sort((a, b) => b.plannedHours - a.plannedHours),
      planVsFact: {
        plannedHours: round1(totalPlannedHours),
        actualHours: round1(totalActualHours),
        diffPercent,
      },
    };
  },
};