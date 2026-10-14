import { eq, and, gte, lte, isNull, isNotNull, count, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users,
  shiftTemplates,
  scheduleWeeks,
  scheduledShifts,
  timeEntries,
} from "../../../db/schema.js";

export const dashboardService = {
  async summary(orgId: string) {
    // Количество сотрудников
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.orgId, orgId));

    // Количество шаблонов
    const [{ value: templateCount }] = await db
      .select({ value: count() })
      .from(shiftTemplates)
      .where(eq(shiftTemplates.orgId, orgId));

    // Недели: всего и по статусам
    const weeks = await db
      .select({ status: scheduleWeeks.status })
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.orgId, orgId));

    const weekStats = {
      total: weeks.length,
      draft: weeks.filter((w) => w.status === "DRAFT").length,
      published: weeks.filter((w) => w.status === "PUBLISHED").length,
    };

    // Ближайшая неделя (минимальная из DRAFT или PUBLISHED)
    const today = new Date().toISOString().slice(0, 10);
    const [nextWeek] = await db
      .select()
      .from(scheduleWeeks)
      .where(
        and(
          eq(scheduleWeeks.orgId, orgId),
          gte(scheduleWeeks.weekStartDate, today),
        ),
      )
      .orderBy(scheduleWeeks.weekStartDate)
      .limit(1);

    let nextWeekShifts = 0;
    if (nextWeek) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(scheduledShifts)
        .where(eq(scheduledShifts.weekId, nextWeek.id));
      nextWeekShifts = value;
    }

    // Сейчас работают (открытые смены у сотрудников этой организации)
    const orgUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));

    const allOpen = await db
      .select()
      .from(timeEntries)
      .where(and(isNotNull(timeEntries.clockIn), isNull(timeEntries.clockOut)));

    const workingNow = allOpen
      .filter((e) => orgUserIds.has(e.userId))
      .map((e) => ({
        entryId: e.id,
        userId: e.userId,
        userName: orgUsers.find((u) => u.id === e.userId)?.name ?? "—",
        clockIn: e.clockIn,
      }));

    // Часов за текущий месяц (по закрытым сменам)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const closedThisMonth = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          isNotNull(timeEntries.clockIn),
          isNotNull(timeEntries.clockOut),
          gte(timeEntries.clockIn, monthStart),
        ),
      );

    const monthlyHours = closedThisMonth
      .filter((e) => orgUserIds.has(e.userId))
      .reduce((sum, e) => {
        const ms = new Date(e.clockOut!).getTime() - new Date(e.clockIn!).getTime();
        return sum + ms / 3600000;
      }, 0);

    return {
      userCount,
      templateCount,
      weekStats,
      nextWeek: nextWeek
        ? {
            id: nextWeek.id,
            weekStartDate: nextWeek.weekStartDate,
            status: nextWeek.status,
            shiftsCount: nextWeekShifts,
          }
        : null,
      workingNow,
      monthlyHours: Math.round(monthlyHours * 10) / 10,
    };
  },
};