import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { users, scheduledShifts, scheduleWeeks, timeEntries } from "../../../db/schema.js";

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

type WeekdayAgg = { weekday: number; label: string; shifts: number; plannedHours: number; payroll: number };
type PositionAgg = { position: string; shifts: number; plannedHours: number; payroll: number; percent: number };

type PeriodResult = {
  totals: {
    hours: number; shifts: number; payroll: number;
    actualPayroll: number; overtimeCost: number; avgCost: number;
  };
  users: any[];
  planVsFact: { plannedHours: number; actualHours: number; diffPercent: number };
  byWeekday: WeekdayAgg[];
  byPosition: PositionAgg[];
};

async function computePeriod(
  orgId: string,
  from: string,
  to: string,
  locationId?: string
): Promise<PeriodResult> {
  const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));

  if (orgUsers.length === 0) {
    return {
      totals: { hours: 0, shifts: 0, payroll: 0, actualPayroll: 0, overtimeCost: 0, avgCost: 0 },
      users: [],
      planVsFact: { plannedHours: 0, actualHours: 0, diffPercent: 0 },
      byWeekday: WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, shifts: 0, plannedHours: 0, payroll: 0 })),
      byPosition: [],
    };
  }

  const rows = await db
    .select({ shift: scheduledShifts })
    .from(scheduledShifts)
    .innerJoin(scheduleWeeks, eq(scheduledShifts.weekId, scheduleWeeks.id))
    .where(
      and(
        gte(scheduledShifts.shiftDate, from),
        lte(scheduledShifts.shiftDate, to),
        locationId ? eq(scheduleWeeks.locationId, locationId) : undefined
      )
    );
  const allShifts = rows.map((r) => r.shift);

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

  const weekdayAgg: WeekdayAgg[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday, label, shifts: 0, plannedHours: 0, payroll: 0,
  }));
  const positionAgg = new Map<string, { shifts: number; plannedHours: number; payroll: number }>();

  let totalPlannedHours = 0;
  let totalActualHours = 0;
  let totalPlannedPayroll = 0;
  let totalActualPayroll = 0;
  let totalOvertimeCost = 0;

  const userStats = orgUsers.map((u) => {
    const userShifts = shifts.filter((s) => s.userId === u.id);
    const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
    const plannedHours = userShifts.reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0);
    const userEntries = orgEntries.filter((e) => e.userId === u.id);
    const actualHours = userEntries.reduce((sum, e) => {
      const end = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
      const start = new Date(e.clockIn!).getTime();
      return sum + (end - start) / 3600000;
    }, 0);

    const plannedPayroll = rate * plannedHours;
    const actualPayroll = rate * actualHours;
    const overtimeHours = Math.max(0, actualHours - 160);
    const overtimeCost = overtimeHours * rate * 1.5;

    totalPlannedHours += plannedHours;
    totalActualHours += actualHours;
    totalPlannedPayroll += plannedPayroll;
    totalActualPayroll += actualPayroll;
    totalOvertimeCost += overtimeCost;

    const positionKey = u.position?.trim() || "Без должности";
    if (!positionAgg.has(positionKey)) {
      positionAgg.set(positionKey, { shifts: 0, plannedHours: 0, payroll: 0 });
    }
    const posAgg = positionAgg.get(positionKey)!;

    for (const s of userShifts) {
      const h = hoursBetween(s.startTime, s.endTime);
      const pay = h * rate;
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
      hourlyRate: rate || null, shiftsCount: userShifts.length,
      plannedHours: round1(plannedHours), actualHours: round1(actualHours),
      plannedPayroll: Math.round(plannedPayroll), actualPayroll: Math.round(actualPayroll),
      overtimeHours: round1(overtimeHours), overtimeCost: Math.round(overtimeCost),
    };
  });

  const diffPercent =
    totalPlannedHours > 0
      ? round1(((totalActualHours - totalPlannedHours) / totalPlannedHours) * 100)
      : 0;

  for (const w of weekdayAgg) {
    w.plannedHours = round1(w.plannedHours);
    w.payroll = Math.round(w.payroll);
  }

  const byPosition: PositionAgg[] = Array.from(positionAgg.entries())
    .map(([position, agg]) => ({
      position,
      shifts: agg.shifts,
      plannedHours: round1(agg.plannedHours),
      payroll: Math.round(agg.payroll),
      percent: totalPlannedPayroll > 0 ? round1((agg.payroll / totalPlannedPayroll) * 100) : 0,
    }))
    .sort((a, b) => b.payroll - a.payroll);

  return {
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
    byWeekday: weekdayAgg,
    byPosition,
  };
}

export const analyticsService = {
  async summary(orgId: string, from: string, to: string, locationId?: string) {
    const { prevFrom, prevTo } = prevMonthRange(from);
    const [current, prev] = await Promise.all([
      computePeriod(orgId, from, to, locationId),
      computePeriod(orgId, prevFrom, prevTo, locationId),
    ]);

    const mom = {
      hours: pctChange(current.totals.hours, prev.totals.hours),
      shifts: pctChange(current.totals.shifts, prev.totals.shifts),
      payroll: pctChange(current.totals.payroll, prev.totals.payroll),
      actualPayroll: pctChange(current.totals.actualPayroll, prev.totals.actualPayroll),
      avgCost: pctChange(current.totals.avgCost, prev.totals.avgCost),
    };

    return {
      period: { from, to },
      prevPeriod: { from: prevFrom, to: prevTo },
      totals: { ...current.totals, mom },
      users: current.users,
      planVsFact: current.planVsFact,
      byWeekday: current.byWeekday,
      byPosition: current.byPosition,
    };
  },
};