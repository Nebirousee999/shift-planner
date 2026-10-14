import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  scheduledShifts,
  scheduleWeeks,
  shiftTemplates,
  users,
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
      .where(
        and(eq(users.id, input.userId), eq(users.orgId, input.orgId))
      );
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
      .where(
        and(eq(users.id, input.userId), eq(users.orgId, input.orgId))
      );
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
  }) {
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
        .where(
          and(eq(users.id, input.userId), eq(users.orgId, input.orgId))
        );
      if (!u) throw new Error("USER_NOT_FOUND");
    }

    const [shift] = await db
      .insert(scheduledShifts)
      .values({
        weekId: input.weekId,
        templateId: input.templateId,
        userId: input.userId,
        shiftDate: input.shiftDate,
        startTime: input.startTime,
        endTime: input.endTime,
      })
      .returning();
    return shift;
  },

  // ─── Обновить смену ────────────────────────────────────
  async update(input: {
    id: string;
    orgId: string;
    templateId?: string | null;
    userId?: string | null;
    shiftDate?: string;
    startTime?: string;
    endTime?: string;
  }) {
    // Находим смену и её неделю
    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, input.id));
    if (!shift) return null;

    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.id, shift.weekId));
    if (!week || week.orgId !== input.orgId) return null;

    // Редактировать можно всё, кроме LOCKED
    if (week.status === "LOCKED") throw new Error("WEEK_LOCKED");

    const [updated] = await db
      .update(scheduledShifts)
      .set({
        ...(input.templateId !== undefined && {
          templateId: input.templateId,
        }),
        ...(input.userId !== undefined && { userId: input.userId }),
        ...(input.shiftDate !== undefined && {
          shiftDate: input.shiftDate,
        }),
        ...(input.startTime !== undefined && {
          startTime: input.startTime,
        }),
        ...(input.endTime !== undefined && { endTime: input.endTime }),
      })
      .where(eq(scheduledShifts.id, input.id))
      .returning();
    return updated;
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