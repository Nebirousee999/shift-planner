import { eq, and, or, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  scheduledShifts,
  scheduleWeeks,
  shiftTemplates,
  users,
  shiftChangeRequests,
} from "../../../db/schema.js";
import { isWithinWeek, toDateStr, shiftsOverlap } from "../../lib/time.js";
import { messengerService } from "../../lib/messenger.service.js";

const WEEKLY_LIMIT_HOURS = 40;

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const scheduledShiftsService = {
  async checkLimits(input: {
    orgId: string;
    userId: string;
    weekId: string;
    startTime: string;
    endTime: string;
    excludeShiftId?: string;
  }) {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, input.weekId), eq(scheduleWeeks.orgId, input.orgId)));
    if (!week) throw new Error("WEEK_NOT_FOUND");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    const allShifts = await db
      .select()
      .from(scheduledShifts)
      .where(and(
        eq(scheduledShifts.weekId, input.weekId),
        eq(scheduledShifts.userId, input.userId),
      ));

    const filtered = input.excludeShiftId
      ? allShifts.filter((s) => s.id !== input.excludeShiftId)
      : allShifts;

    const currentHours = filtered.reduce(
      (sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0
    );
    const newShiftHours = hoursBetween(input.startTime, input.endTime);
    const totalHours = currentHours + newShiftHours;

    return {
      currentHours: round1(currentHours),
      newShiftHours: round1(newShiftHours),
      totalHours: round1(totalHours),
      limit: WEEKLY_LIMIT_HOURS,
      exceeds: totalHours > WEEKLY_LIMIT_HOURS,
      excess: round1(Math.max(0, totalHours - WEEKLY_LIMIT_HOURS)),
      userName: user.name,
    };
  },

  async checkOverlap(input: {
    orgId: string;
    userId: string;
    weekId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    excludeShiftId?: string;
  }) {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, input.weekId), eq(scheduleWeeks.orgId, input.orgId)));
    if (!week) throw new Error("WEEK_NOT_FOUND");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    const dayShifts = await db
      .select()
      .from(scheduledShifts)
      .where(and(
        eq(scheduledShifts.userId, input.userId),
        eq(scheduledShifts.shiftDate, input.shiftDate),
      ));

    const filtered = input.excludeShiftId
      ? dayShifts.filter((s) => s.id !== input.excludeShiftId)
      : dayShifts;

    const newShift = {
      date: input.shiftDate,
      start: input.startTime,
      end: input.endTime,
    };

    const overlapping = filtered.filter((s) => {
      const other = {
        date: String(s.shiftDate).slice(0, 10),
        start: s.startTime,
        end: s.endTime,
      };
      return shiftsOverlap(newShift, other);
    });

    return {
      overlaps: overlapping.length > 0,
      userName: user.name,
      conflicting: overlapping.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    };
  },

  async create(input: {
    orgId: string;
    weekId: string;
    templateId?: string;
    userId?: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    requesterId: string;
    requesterRole: "OWNER" | "MANAGER" | "EMPLOYEE";
  }): Promise<
    | { kind: "applied"; shift: any }
    | { kind: "requested"; request: any }
  > {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, input.weekId), eq(scheduleWeeks.orgId, input.orgId)));
    if (!week) throw new Error("WEEK_NOT_FOUND");
    if (week.status === "LOCKED") throw new Error("WEEK_LOCKED");

    const weekStart = toDateStr(week.weekStartDate);
    if (!isWithinWeek(input.shiftDate, weekStart)) throw new Error("DATE_OUT_OF_WEEK");

    if (input.templateId) {
      const [tpl] = await db
        .select()
        .from(shiftTemplates)
        .where(and(
          eq(shiftTemplates.id, input.templateId),
          eq(shiftTemplates.orgId, input.orgId),
        ));
      if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");
    }

    if (input.userId) {
      const [u] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
      if (!u) throw new Error("USER_NOT_FOUND");
    }

    const values = {
      weekId: input.weekId,
      templateId: input.templateId,
      userId: input.userId,
      shiftDate: input.shiftDate,
      startTime: input.startTime,
      endTime: input.endTime,
      latenessMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      isNoShow: false,
      isUnknownAbsence: false,
    };

    const isManager =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";

    if (week.status === "DRAFT") {
      const [shift] = await db.insert(scheduledShifts).values(values).returning();
      return { kind: "applied", shift };
    }

    let targetUserId: string | null = null;

    if (!isManager) {
      const [manager] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.orgId, input.orgId),
          or(eq(users.role, "OWNER"), eq(users.role, "MANAGER")),
        ))
        .orderBy(sql`CASE WHEN ${users.role} = 'OWNER' THEN 0 ELSE 1 END`)
        .limit(1);
      targetUserId = manager?.id ?? null;
    } else {
      if (!input.userId) {
        const [shift] = await db.insert(scheduledShifts).values(values).returning();
        return { kind: "applied", shift };
      }
      targetUserId = input.userId;
    }

    if (!targetUserId || targetUserId === input.requesterId) {
      const [shift] = await db.insert(scheduledShifts).values(values).returning();
      return { kind: "applied", shift };
    }

    const [request] = await db
      .insert(shiftChangeRequests)
      .values({
        orgId: input.orgId,
        shiftId: null,
        kind: "CREATE",
        weekId: input.weekId,
        templateId: input.templateId ?? null,
        requestedBy: input.requesterId,
        targetUserId,
        oldShiftDate: input.shiftDate,
        oldStartTime: input.startTime,
        oldEndTime: input.endTime,
        oldUserId: null,
        newShiftDate: input.shiftDate,
        newStartTime: input.startTime,
        newEndTime: input.endTime,
        newUserId: input.userId ?? null,
      })
      .returning();

    await messengerService.sendToUser(
      targetUserId,
      `<b>Новая смена</b>\n\nРуководитель предлагает вам смену на ${input.shiftDate} (${input.startTime}–${input.endTime}).\nЗайдите в приложение, чтобы подтвердить.`
    );

    return { kind: "requested", request };
  },

  async update(input: {
    id: string;
    orgId: string;
    requesterId: string;
    requesterRole: "OWNER" | "MANAGER" | "EMPLOYEE";
    templateId?: string | null;
    userId?: string | null;
    shiftDate?: string;
    startTime?: string;
    endTime?: string;
    latenessMinutes?: number;
    earlyLeaveMinutes?: number;
    overtimeMinutes?: number;
    isNoShow?: boolean;
    isUnknownAbsence?: boolean;
  }): Promise<
    | { kind: "applied"; shift: any }
    | { kind: "requested"; request: any }
  > {
    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, input.id));
    if (!shift) throw new Error("SHIFT_NOT_FOUND");

    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.id, shift.weekId));
    if (!week || week.orgId !== input.orgId) throw new Error("SHIFT_NOT_FOUND");

    if (week.status === "LOCKED") throw new Error("WEEK_LOCKED");

    const isManager =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";

    // Только дисциплинарные метрики — применяем сразу, без согласования
    const isOnlyDiscipline =
      (input.latenessMinutes !== undefined ||
        input.earlyLeaveMinutes !== undefined ||
        input.overtimeMinutes !== undefined ||
        input.isNoShow !== undefined ||
        input.isUnknownAbsence !== undefined) &&
      input.templateId === undefined &&
      input.userId === undefined &&
      input.shiftDate === undefined &&
      input.startTime === undefined &&
      input.endTime === undefined;

    if (week.status === "DRAFT" || isOnlyDiscipline) {
      const [updated] = await db
        .update(scheduledShifts)
        .set({
          ...(input.templateId !== undefined && { templateId: input.templateId }),
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.shiftDate !== undefined && { shiftDate: input.shiftDate }),
          ...(input.startTime !== undefined && { startTime: input.startTime }),
          ...(input.endTime !== undefined && { endTime: input.endTime }),
          ...(input.latenessMinutes !== undefined && { latenessMinutes: input.latenessMinutes }),
          ...(input.earlyLeaveMinutes !== undefined && { earlyLeaveMinutes: input.earlyLeaveMinutes }),
          ...(input.overtimeMinutes !== undefined && { overtimeMinutes: input.overtimeMinutes }),
          ...(input.isNoShow !== undefined && { isNoShow: input.isNoShow }),
          ...(input.isUnknownAbsence !== undefined && { isUnknownAbsence: input.isUnknownAbsence }),
        })
        .where(eq(scheduledShifts.id, input.id))
        .returning();
      return { kind: "applied", shift: updated };
    }

    const oldDate = String(shift.shiftDate).slice(0, 10);
    const newDate = input.shiftDate ?? oldDate;
    const newStart = input.startTime ?? shift.startTime;
    const newEnd = input.endTime ?? shift.endTime;
    const newUserId = input.userId !== undefined ? input.userId : shift.userId;

    if (
      newDate === oldDate &&
      newStart === shift.startTime &&
      newEnd === shift.endTime &&
      newUserId === shift.userId
    ) {
      return { kind: "applied", shift };
    }

    let targetUserId: string | null = null;

    if (!isManager) {
      const [manager] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.orgId, input.orgId),
          or(eq(users.role, "OWNER"), eq(users.role, "MANAGER")),
        ))
        .orderBy(sql`CASE WHEN ${users.role} = 'OWNER' THEN 0 ELSE 1 END`)
        .limit(1);
      targetUserId = manager?.id ?? null;
    } else {
      const involvedUserId = shift.userId ?? newUserId;
      if (!involvedUserId) {
        const [updated] = await db
          .update(scheduledShifts)
          .set({
            shiftDate: newDate,
            startTime: newStart,
            endTime: newEnd,
            ...(input.userId !== undefined && { userId: input.userId }),
            ...(input.templateId !== undefined && { templateId: input.templateId }),
            ...(input.latenessMinutes !== undefined && { latenessMinutes: input.latenessMinutes }),
            ...(input.earlyLeaveMinutes !== undefined && { earlyLeaveMinutes: input.earlyLeaveMinutes }),
            ...(input.overtimeMinutes !== undefined && { overtimeMinutes: input.overtimeMinutes }),
            ...(input.isNoShow !== undefined && { isNoShow: input.isNoShow }),
            ...(input.isUnknownAbsence !== undefined && { isUnknownAbsence: input.isUnknownAbsence }),
          })
          .where(eq(scheduledShifts.id, input.id))
          .returning();
        return { kind: "applied", shift: updated };
      }
      targetUserId = involvedUserId;
    }

    if (!targetUserId || targetUserId === input.requesterId) {
      const [updated] = await db
        .update(scheduledShifts)
        .set({
          shiftDate: newDate,
          startTime: newStart,
          endTime: newEnd,
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.templateId !== undefined && { templateId: input.templateId }),
          ...(input.latenessMinutes !== undefined && { latenessMinutes: input.latenessMinutes }),
          ...(input.earlyLeaveMinutes !== undefined && { earlyLeaveMinutes: input.earlyLeaveMinutes }),
          ...(input.overtimeMinutes !== undefined && { overtimeMinutes: input.overtimeMinutes }),
          ...(input.isNoShow !== undefined && { isNoShow: input.isNoShow }),
          ...(input.isUnknownAbsence !== undefined && { isUnknownAbsence: input.isUnknownAbsence }),
        })
        .where(eq(scheduledShifts.id, input.id))
        .returning();
      return { kind: "applied", shift: updated };
    }

    const [request] = await db
      .insert(shiftChangeRequests)
      .values({
        orgId: input.orgId,
        shiftId: shift.id,
        requestedBy: input.requesterId,
        targetUserId,
        oldShiftDate: oldDate,
        oldStartTime: shift.startTime,
        oldEndTime: shift.endTime,
        oldUserId: shift.userId,
        newShiftDate: newDate,
        newStartTime: newStart,
        newEndTime: newEnd,
        newUserId,
      })
      .returning();

    return { kind: "requested", request };
  },

  async remove(id: string, orgId: string) {
    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, id));
    if (!shift) return null;

    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.id, shift.weekId));
    if (!week || week.orgId !== orgId) return null;

    if (week.status === "LOCKED") throw new Error("WEEK_LOCKED");

    const [deleted] = await db
      .delete(scheduledShifts)
      .where(eq(scheduledShifts.id, id))
      .returning();
    return deleted;
  },
};