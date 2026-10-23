import { eq, and, or, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  shiftChangeRequests,
  scheduledShifts,
  scheduleWeeks,
  users,
} from "../../../db/schema.js";
import { messengerService } from "../../lib/messenger.service.js";

export const shiftChangeRequestsService = {
  // Все запросы организации (для менеджера)
  async list(orgId: string) {
    const rows = await db
      .select()
      .from(shiftChangeRequests)
      .where(eq(shiftChangeRequests.orgId, orgId))
      .orderBy(desc(shiftChangeRequests.createdAt));

    const orgUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.orgId, orgId));
    const uMap = new Map(orgUsers.map((u) => [u.id, u.name]));

    const shifts = await db.select().from(scheduledShifts);
    const sMap = new Map(shifts.map((s) => [s.id, s]));

    return rows.map((r) => ({
      ...r,
      requestedByName: uMap.get(r.requestedBy) ?? "—",
      targetUserName: uMap.get(r.targetUserId) ?? "—",
      oldUserName: r.oldUserId ? uMap.get(r.oldUserId) ?? "—" : null,
      newUserName: r.newUserId ? uMap.get(r.newUserId) ?? "—" : null,
      shiftExists: sMap.has(r.shiftId),
    }));
  },

  // Входящие запросы ко мне (я должен согласовать)
  async incoming(userId: string) {
    const rows = await db
      .select()
      .from(shiftChangeRequests)
      .where(
        and(
          eq(shiftChangeRequests.targetUserId, userId),
          eq(shiftChangeRequests.status, "PENDING")
        )
      )
      .orderBy(desc(shiftChangeRequests.createdAt));

    const all = await db.select().from(users);
    const uMap = new Map(all.map((u) => [u.id, u.name]));

    return rows.map((r) => ({
      ...r,
      requestedByName: uMap.get(r.requestedBy) ?? "—",
    }));
  },

  // Исходящие запросы от меня
  async outgoing(userId: string) {
    return db
      .select()
      .from(shiftChangeRequests)
      .where(eq(shiftChangeRequests.requestedBy, userId))
      .orderBy(desc(shiftChangeRequests.createdAt));
  },

  async incomingCount(userId: string) {
    const rows = await db
      .select({ id: shiftChangeRequests.id })
      .from(shiftChangeRequests)
      .where(
        and(
          eq(shiftChangeRequests.targetUserId, userId),
          eq(shiftChangeRequests.status, "PENDING")
        )
      );
    return { count: rows.length };
  },

  async approve(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftChangeRequests)
      .where(eq(shiftChangeRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.targetUserId !== userId) throw new Error("NOT_FOR_YOU");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");

    // ─── CREATE — создаём новую смену ───
    if (req.kind === "CREATE") {
      if (!req.weekId) throw new Error("NO_WEEK");

      const [shift] = await db
        .insert(scheduledShifts)
        .values({
          weekId: req.weekId,
          templateId: req.templateId,
          userId: req.newUserId,
          shiftDate: req.newShiftDate,
          startTime: req.newStartTime,
          endTime: req.newEndTime,
        })
        .returning();

      const [updated] = await db
        .update(shiftChangeRequests)
        .set({
          status: "APPROVED",
          reviewedAt: new Date(),
          shiftId: shift.id,
        })
        .where(eq(shiftChangeRequests.id, id))
        .returning();

      // Отправка уведомления для CREATE
      if (req.newUserId) {
        await messengerService.sendToUser(
          req.newUserId,
          `<b>Новая смена</b>\n\nВам назначена смена на ${req.newShiftDate} (${req.newStartTime}–${req.newEndTime}).`
        );
      }

      return updated;
    }

    // ─── UPDATE — обновляем существующую смену ───
    if (!req.shiftId) throw new Error("NO_SHIFT");

    await db
      .update(scheduledShifts)
      .set({
        shiftDate: req.newShiftDate,
        startTime: req.newStartTime,
        endTime: req.newEndTime,
        userId: req.newUserId,
      })
      .where(eq(scheduledShifts.id, req.shiftId));

    const [updated] = await db
      .update(shiftChangeRequests)
      .set({ status: "APPROVED", reviewedAt: new Date() })
      .where(eq(shiftChangeRequests.id, id))
      .returning();

    // Отправка уведомления для UPDATE (до return!)
    if (req.newUserId) {
      await messengerService.sendToUser(
        req.newUserId,
        `<b>Смена изменена</b>\n\nВаша смена перенесена на ${req.newShiftDate} (${req.newStartTime}–${req.newEndTime}).`
      );
    }

    return updated;
  },

  async reject(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftChangeRequests)
      .where(eq(shiftChangeRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.targetUserId !== userId) throw new Error("NOT_FOR_YOU");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");

    const [updated] = await db
      .update(shiftChangeRequests)
      .set({ status: "REJECTED", reviewedAt: new Date() })
      .where(eq(shiftChangeRequests.id, id))
      .returning();
    return updated;
  },

  async cancel(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftChangeRequests)
      .where(eq(shiftChangeRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.requestedBy !== userId) throw new Error("NOT_YOURS");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");

    await db.delete(shiftChangeRequests).where(eq(shiftChangeRequests.id, id));
    return { success: true };
  },
};