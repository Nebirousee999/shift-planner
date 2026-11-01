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
  async summary(orgId: string, locationId?: string, date?: string) {
    const todayDate = new Date().toISOString().slice(0, 10);
    const targetDate = date || todayDate; // <--- Используем переданную дату

    const weekConditions = [
      eq(scheduleWeeks.orgId, orgId),
      lte(scheduleWeeks.weekStartDate, targetDate),
      gte(sql`${scheduleWeeks.weekStartDate} + interval '6 days'`, targetDate),
    ];
    if (locationId) weekConditions.push(eq(scheduleWeeks.locationId, locationId));

    const [currentWeek] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(...weekConditions))
      .limit(1);

    let weekShifts: any[] = [];
    let weekTimeEntries: any[] = [];
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

    let todayShifts: any[] = [];
    if (isPublished) {
      const todayShiftsRaw = await db
        .select({
          id: scheduledShifts.id,
          startTime: scheduledShifts.startTime,
          endTime: scheduledShifts.endTime,
          userId: users.id,
          userName: users.name,
          latenessMinutes: scheduledShifts.latenessMinutes,
          earlyLeaveMinutes: scheduledShifts.earlyLeaveMinutes,
          overtimeMinutes: scheduledShifts.overtimeMinutes,
          userPosition: users.position,
          templateId: shiftTemplates.id,
          templateColor: shiftTemplates.color,
          templateStartTime: shiftTemplates.startTime,
          templateEndTime: shiftTemplates.endTime,
          templateName: shiftTemplates.name,
          isNoShow: scheduledShifts.isNoShow,
          isUnknownAbsence: scheduledShifts.isUnknownAbsence,
        })
        .from(scheduledShifts)
        .innerJoin(scheduleWeeks, eq(scheduledShifts.weekId, scheduleWeeks.id))
        .leftJoin(users, eq(scheduledShifts.userId, users.id))
        .leftJoin(shiftTemplates, eq(scheduledShifts.templateId, shiftTemplates.id))
        .where(
          and(
            eq(scheduledShifts.shiftDate, targetDate),
            isNotNull(scheduledShifts.userId),
            locationId ? eq(scheduleWeeks.locationId, locationId) : undefined
          )
        );

      const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
      const orgUserIds = new Set(orgUsers.map((u) => u.id));
      todayShifts = todayShiftsRaw.filter((s) => s.userId && orgUserIds.has(s.userId));
    }

    const orgUsersData = await db
      .select({ id: users.id, name: users.name, hourlyRate: users.hourlyRate, position: users.position })
      .from(users)
      .where(eq(users.orgId, orgId));

    const orgUserIds = new Set(orgUsersData.map((u) => u.id));
    const validWeekTimeEntries = weekTimeEntries.filter((te) => orgUserIds.has(te.userId));

    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.orgId, orgId));

    return {
      currentWeek: currentWeek
        ? {
            id: currentWeek.id,
            weekStartDate: currentWeek.weekStartDate,
            locationId: currentWeek.locationId,
            status: currentWeek.status,
            shifts: weekShifts,
          }
        : null,
      todayShifts,
      weekTimeEntries: validWeekTimeEntries,
      userCount,
      users: orgUsersData,
      monthlyHours: 0,
    };
  },
};