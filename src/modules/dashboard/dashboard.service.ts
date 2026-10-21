import { eq, and, gte, lte, isNotNull, count, sql } from "drizzle-orm";
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
    const todayDate = new Date().toISOString().slice(0, 10);

    // 1. Находим текущую неделю
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
    
    // Если неделя опубликована, показываем смены и отработанное время
    const isPublished = currentWeek?.status === "PUBLISHED";

    if (currentWeek && isPublished) {
      weekShifts = await db
        .select()
        .from(scheduledShifts)
        .where(eq(scheduledShifts.weekId, currentWeek.id));

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

    // 2. Смены на сегодня
    let todayShifts: any[] = [];
    
    if (isPublished) {
      const todayShiftsRaw = await db
        .select({
          id: scheduledShifts.id,
          startTime: scheduledShifts.startTime,
          endTime: scheduledShifts.endTime,
          userId: users.id,
          userName: users.name,
          latenessMinutes: scheduledShifts.latenessMinutes, // <--- ДОБАВИТЬ
          earlyLeaveMinutes: scheduledShifts.earlyLeaveMinutes, // <--- ДОБАВИТЬ
          overtimeMinutes: scheduledShifts.overtimeMinutes,
          userPosition: users.position,
          templateId: shiftTemplates.id,
          templateColor: shiftTemplates.color,
          templateStartTime: shiftTemplates.startTime, // <--- ДОБАВИТЬ
          templateEndTime: shiftTemplates.endTime,     // <--- ДОБАВИТЬ
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

    // 3. Список сотрудников для расчета затрат
    const orgUsersData = await db
      .select({ 
        id: users.id, 
        name: users.name, 
        hourlyRate: users.hourlyRate, 
        position: users.position 
      })
      .from(users)
      .where(eq(users.orgId, orgId));
      
    const orgUserIds = new Set(orgUsersData.map(u => u.id));
    
    // Фильтруем записи времени, чтобы не было лишних
    const validWeekTimeEntries = weekTimeEntries.filter(te => orgUserIds.has(te.userId));

    // 4. Общее количество сотрудников
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
      userCount,
      users: orgUsersData,
      monthlyHours: 0,
    };
  },
};