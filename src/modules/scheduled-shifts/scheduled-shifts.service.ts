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
  // ─── Проверка лимита ТК РФ (40 ч/нед) ─────────────────
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
      .where(
        and(
          eq(scheduleWeeks.id, input.weekId),
          eq(scheduleWeeks.orgId, input.orgId)
        )
      );
    if (!week) throw new Error("WEEK_NOT_FOUND");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    const allShifts = await db
      .select()
      .from(scheduledShifts)
      .where(
        and(
          eq(scheduledShifts.weekId, input.weekId),
          eq(scheduledShifts.userId, input.userId)
        )
      );

    const filtered = input.excludeShiftId
      ? allShifts.filter((s) => s.id !== input.excludeShiftId)
      : allShifts;

    const currentHours = filtered.reduce(
      (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
      0
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

  // ─── Проверка пересечения смен в один день ────────────
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
      .where(
        and(
          eq(scheduleWeeks.id, input.weekId),
          eq(scheduleWeeks.orgId, input.orgId)
        )
      );
    if (!week) throw new Error("WEEK_NOT_FOUND");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    // Смены сотрудника в этот день
    const dayShifts = await db
      .select()
      .from(scheduledShifts)
      .where(
        and(
          eq(scheduledShifts.userId, input.userId),
          eq(scheduledShifts.shiftDate, input.shiftDate)
        )
      );

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

  // ─── Создать смену ─────────────────────────────────────
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
    // 1. Неделя принадлежит организации?
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(
        and(
          eq(scheduleWeeks.id, input.weekId),
          eq(scheduleWeeks.orgId, input.orgId)
        )
      );
    if (!week) throw new Error("WEEK_NOT_FOUND");
    if (week.status === "LOCKED") throw new Error("WEEK_LOCKED");

    // 2. Дата попадает в неделю?
    const weekStart = toDateStr(week.weekStartDate);
    if (!isWithinWeek(input.shiftDate, weekStart)) {
      throw new Error("DATE_OUT_OF_WEEK");
    }

    // 3. Шаблон принадлежит организации?
    if (input.templateId) {
      const [tpl] = await db
        .select()
        .from(shiftTemplates)
        .where(
          and(
            eq(shiftTemplates.id, input.templateId),
            eq(shiftTemplates.orgId, input.orgId)
          )
        );
      if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");
    }

    // 4. Сотрудник принадлежит организации?
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
    };

    const isManager =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";

    // ─── Черновик — применяем сразу ───
    if (week.status === "DRAFT") {
      const [shift] = await db
        .insert(scheduledShifts)
        .values(values)
        .returning();
      return { kind: "applied", shift };
    }

    // ─── Опубликовано — нужен запрос ───

    let targetUserId: string | null = null;

    if (!isManager) {
      // Сотрудник создаёт — согласовывает OWNER (приоритет), иначе MANAGER
      const [manager] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.orgId, input.orgId),
            or(eq(users.role, "OWNER"), eq(users.role, "MANAGER"))
          )
        )
        .orderBy(sql`CASE WHEN ${users.role} = 'OWNER' THEN 0 ELSE 1 END`)
        .limit(1);
      targetUserId = manager?.id ?? null;
    } else {
      // Менеджер создаёт — согласовывает тот сотрудник, кому назначают
      if (!input.userId) {
        // никому не назначена — применяем сразу
        const [shift] = await db
          .insert(scheduledShifts)
          .values(values)
          .returning();
        return { kind: "applied", shift };
      }
      targetUserId = input.userId;
    }

    // Некому согласовывать или сам себе — применяем сразу
    if (!targetUserId || targetUserId === input.requesterId) {
      const [shift] = await db
        .insert(scheduledShifts)
        .values(values)
        .returning();
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
        // Для CREATE старых значений нет — дублируем новые, чтобы UI не сломался
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

    return { kind: "requested", request };
  },

  // ─── Обновить смену ────────────────────────────────────
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

    // ─── Черновик — правим сразу ───
    if (week.status === "DRAFT") {
      const [updated] = await db
        .update(scheduledShifts)
        .set({
          ...(input.templateId !== undefined && { templateId: input.templateId }),
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.shiftDate !== undefined && { shiftDate: input.shiftDate }),
          ...(input.startTime !== undefined && { startTime: input.startTime }),
          ...(input.endTime !== undefined && { endTime: input.endTime }),
        })
        .where(eq(scheduledShifts.id, input.id))
        .returning();
      return { kind: "applied", shift: updated };
    }

    // ─── Опубликовано — нужен запрос ───
    const oldDate = String(shift.shiftDate).slice(0, 10);
    const newDate = input.shiftDate ?? oldDate;
    const newStart = input.startTime ?? shift.startTime;
    const newEnd = input.endTime ?? shift.endTime;
    const newUserId =
      input.userId !== undefined ? input.userId : shift.userId;

    // Ничего не изменилось
    if (
      newDate === oldDate &&
      newStart === shift.startTime &&
      newEnd === shift.endTime &&
      newUserId === shift.userId
    ) {
      return { kind: "applied", shift };
    }

    // Определяем, кому согласовывать
    let targetUserId: string | null = null;

    if (!isManager) {
      // Сотрудник → согласовывает OWNER (приоритет), иначе MANAGER
      const [manager] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.orgId, input.orgId),
            or(eq(users.role, "OWNER"), eq(users.role, "MANAGER"))
          )
        )
        .orderBy(sql`CASE WHEN ${users.role} = 'OWNER' THEN 0 ELSE 1 END`)
        .limit(1);
      targetUserId = manager?.id ?? null;
    } else {
      // Менеджер → согласовывает сотрудник, чью смену меняют.
      // Если смена ничья — согласовывать не с кем, применяем сразу.
      const involvedUserId = shift.userId ?? newUserId;
      if (!involvedUserId) {
        const [updated] = await db
          .update(scheduledShifts)
          .set({
            shiftDate: newDate,
            startTime: newStart,
            endTime: newEnd,
            ...(input.userId !== undefined && { userId: input.userId }),
            ...(input.templateId !== undefined && {
              templateId: input.templateId,
            }),
          })
          .where(eq(scheduledShifts.id, input.id))
          .returning();
        return { kind: "applied", shift: updated };
      }
      targetUserId = involvedUserId;
    }

    // Если согласовывать некому — применяем сразу
    if (!targetUserId) {
      const [updated] = await db
        .update(scheduledShifts)
        .set({
          shiftDate: newDate,
          startTime: newStart,
          endTime: newEnd,
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.templateId !== undefined && {
            templateId: input.templateId,
          }),
        })
        .where(eq(scheduledShifts.id, input.id))
        .returning();
      return { kind: "applied", shift: updated };
    }

    // Сам себе — применяем сразу
    if (targetUserId === input.requesterId) {
      const [updated] = await db
        .update(scheduledShifts)
        .set({
          shiftDate: newDate,
          startTime: newStart,
          endTime: newEnd,
          ...(input.userId !== undefined && { userId: input.userId }),
          ...(input.templateId !== undefined && {
            templateId: input.templateId,
          }),
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

  // ─── Удалить смену ─────────────────────────────────────
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