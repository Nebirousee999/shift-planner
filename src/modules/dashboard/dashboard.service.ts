import { eq, and, gte, lte, isNull, isNotNull, count, sql, inArray } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users,
  shiftTemplates,
  scheduleWeeks,
  scheduledShifts,
  timeEntries,
  shiftChangeRequests, // 👈 Добавляем импорт
} from "../../../db/schema.js";

export const dashboardService = {
  async summary(orgId: string, customDate?: string) {
    const todayDate = customDate || new Date().toISOString().slice(0, 10);

    const [currentWeek] = await db
      .select()
      .from(scheduleWeeks)
      .where(
        and(
          eq(scheduleWeeks.orgId, orgId),
          lte(scheduleWeeks.weekStartDate, todayDate),
          gte(sql`${scheduleWeeks.weekStartDate} + interval '6 days'`, todayDate)
        )
      )
      .limit(1);

    let weekShifts: any[] = [];
    let weekTimeEntries: any[] = [];
    let weekShiftChanges: any[] = []; // 👈 Добавляем переменную
    
    const isPublished = currentWeek?.status === "PUBLISHED";

    if (currentWeek && isPublished) {
      weekShifts = await db
        .select()
        .from(scheduledShifts)
        .where(eq(scheduledShifts.weekId, currentWeek.id));

      // Если есть смены, ищем одобренные запросы на их изменение
      if (weekShifts.length > 0) {
        const shiftIds = weekShifts.map((s) => s.id);
        weekShiftChanges = await db
          .select()
          .from(shiftChangeRequests)
          .where(
            and(
              eq(shiftChangeRequests.status, "APPROVED"),
              inArray(shiftChangeRequests.shiftId, shiftIds)
            )
          );
      }

      const start = currentWeek.weekStartDate;
      const d = new Date(start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 6);
      const end = d.toISOString().slice(0, 10);

      weekTimeEntries = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            isNotNull(timeEntries.clockIn),
            gte(timeEntries.clockIn, new Date(start + "T00:00:00Z")),
            lte(timeEntries.clockIn, new Date(end + "T23:59:59Z"))
          )
        );
    }

    let todayShifts: any[] = [];
    
    if (isPublished) {
      const todayShiftsRaw = await db
        .select({
          id: scheduledShifts.id,
          startTime: scheduledShifts.startTime,
          endTime: scheduledShifts.endTime,
          shiftDate: scheduledShifts.shiftDate, // 👈 Добавили дату, она понадобится
          userId: users.id,
          userName: users.name,
          userPosition: users.position,
          templateId: shiftTemplates.id,
          templateColor: shiftTemplates.color,
        })
        .from(scheduledShifts)
        .leftJoin(users, eq(scheduledShifts.userId, users.id))
        .leftJoin(shiftTemplates, eq(scheduledShifts.templateId, shiftTemplates.id))
        .where(
          and(
            eq(scheduledShifts.shiftDate, todayDate),
            isNotNull(scheduledShifts.userId)
          )
        );

      const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
      const orgUserIds = new Set(orgUsers.map(u => u.id));
      
      todayShifts = todayShiftsRaw.filter(s => s.userId && orgUserIds.has(s.userId));
    }

    const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map(u => u.id));
    const validWeekTimeEntries = weekTimeEntries.filter(te => orgUserIds.has(te.userId));

    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.orgId, orgId));

    return {
      currentWeek: currentWeek ? { 
        id: currentWeek.id, 
        weekStartDate: currentWeek.weekStartDate,
        status: currentWeek.status,
        shifts: weekShifts 
      } : null,
      todayShifts,
      weekTimeEntries: validWeekTimeEntries,
      weekShiftChanges, // 👈 Возвращаем на фронтенд
      userCount,
      monthlyHours: 0,
    };
  },
};