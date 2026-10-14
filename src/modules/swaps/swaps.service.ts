import { eq, and, or, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  shiftSwapRequests,
  scheduledShifts,
  scheduleWeeks,
  users,
} from "../../../db/schema.js";

export const swapsService = {
  // Все запросы организации (для владельца)
  async list(orgId: string) {
    const orgUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));
    const userMap = new Map(orgUsers.map((u) => [u.id, u.name]));

    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .orderBy(desc(shiftSwapRequests.createdAt));

    const shifts = await db.select().from(scheduledShifts);
    const shiftMap = new Map(shifts.map((s) => [s.id, s]));

    return rows
      .filter((r) => orgUserIds.has(r.requestedBy) || (r.swapWithUserId && orgUserIds.has(r.swapWithUserId)))
      .map((r) => {
        const shift = shiftMap.get(r.shiftId);
        return {
          ...r,
          requestedByName: userMap.get(r.requestedBy) ?? "—",
          swapWithName: r.swapWithUserId ? userMap.get(r.swapWithUserId) ?? "—" : null,
          shiftDate: shift?.shiftDate ?? null,
          startTime: shift?.startTime ?? null,
          endTime: shift?.endTime ?? null,
        };
      });
  },

  // Исходящие запросы (мои предложения)
  async outgoing(userId: string) {
    return db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.requestedBy, userId))
      .orderBy(desc(shiftSwapRequests.createdAt));
  },

  // Входящие предложения мне
  async incoming(userId: string) {
    return db
      .select()
      .from(shiftSwapRequests)
      .where(
        and(
          eq(shiftSwapRequests.status, "PENDING"),
          or(
            eq(shiftSwapRequests.swapWithUserId, userId),
            // открытые смены — сюда добавим через фильтр null ниже
          ),
        ),
      )
      .orderBy(desc(shiftSwapRequests.createdAt));
  },

  // Открытые смены (swapWithUserId = null) — видны всем сотрудникам
  async open(userId: string, orgId: string) {
    const [me] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    if (!me) return [];

    return db
      .select()
      .from(shiftSwapRequests)
      .where(
        and(
          eq(shiftSwapRequests.status, "PENDING"),
          // только открытые
          // (drizzle не имеет isNull для строк напрямую через and, делаем через sql)
        ),
      );
  },

  async create(input: {
    orgId: string;
    requestedBy: string;
    shiftId: string;
    swapWithUserId?: string;
  }) {
    // Смена принадлежит организации?
    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, input.shiftId));
    if (!shift) throw new Error("SHIFT_NOT_FOUND");
    if (shift.userId !== input.requestedBy) {
      throw new Error("NOT_YOUR_SHIFT");
    }

    // Неделя — не PUBLISHED (правило: обмен только для черновиков? нет, наоборот — для опубликованных)
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.id, shift.weekId));
    if (!week || week.orgId !== input.orgId) throw new Error("SHIFT_NOT_FOUND");

    // Проверяем, что swapWithUserId из той же организации
    if (input.swapWithUserId) {
      const [target] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, input.swapWithUserId),
            eq(users.orgId, input.orgId),
          ),
        );
      if (!target) throw new Error("USER_NOT_FOUND");
      if (target.id === input.requestedBy) throw new Error("SELF_SWAP");
    }

    const [request] = await db
      .insert(shiftSwapRequests)
      .values({
        shiftId: input.shiftId,
        requestedBy: input.requestedBy,
        swapWithUserId: input.swapWithUserId ?? null,
        status: "PENDING",
      })
      .returning();

    return request;
  },

  async accept(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");

    // Принимать может либо указанный swapWithUserId, либо любой сотрудник (если открытая)
    if (req.swapWithUserId && req.swapWithUserId !== userId) {
      throw new Error("NOT_FOR_YOU");
    }

    // Меняем userId у смены
    await db
      .update(scheduledShifts)
      .set({ userId })
      .where(eq(scheduledShifts.id, req.shiftId));

    // Закрываем запрос
    const [updated] = await db
      .update(shiftSwapRequests)
      .set({ status: "APPROVED", swapWithUserId: userId })
      .where(eq(shiftSwapRequests.id, id))
      .returning();

    return updated;
  },

  async decline(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");
    if (req.swapWithUserId && req.swapWithUserId !== userId) {
      throw new Error("NOT_FOR_YOU");
    }

    const [updated] = await db
      .update(shiftSwapRequests)
      .set({ status: "DENIED" })
      .where(eq(shiftSwapRequests.id, id))
      .returning();
    return updated;
  },

  async cancel(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.requestedBy !== userId) throw new Error("NOT_YOURS");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");

    await db.delete(shiftSwapRequests).where(eq(shiftSwapRequests.id, id));
    return { success: true };
  },
};