import { eq, and, ne, desc, notInArray, gte, lte } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  shiftSwapRequests,
  scheduledShifts,
  scheduleWeeks,
  users,
} from "../../../db/schema.js";
import { shiftsOverlap } from "../../lib/time.js";
import { notificationsService } from "../notifications/notifications.service.js";

async function enrichSwaps(rows: any[]) {
  if (rows.length === 0) return [];
  const shifts = await db.select().from(scheduledShifts);
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const allUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  return rows.map((r) => {
    const shift = shiftMap.get(r.shiftId);
    return {
      ...r,
      requestedByName: userMap.get(r.requestedBy) ?? "—",
      swapWithName: r.swapWithUserId
        ? userMap.get(r.swapWithUserId) ?? "—"
        : null,
      shiftDate: shift?.shiftDate ?? null,
      startTime: shift?.startTime ?? null,
      endTime: shift?.endTime ?? null,
      templateId: shift?.templateId ?? null,
    };
  });
}

function getShiftRange(dateStr: string, startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const baseTs = new Date(dateStr + "T00:00:00Z").getTime();
  const startTs = baseTs + (sh * 60 + sm) * 60000;
  let endTs = baseTs + (eh * 60 + em) * 60000;
  if (endTs <= startTs) endTs += 24 * 60 * 60000; // ночная смена
  return { start: startTs, end: endTs };
}

function shiftsOverlapSafe(
  a: { date: string; start: string; end: string },
  b: { date: string; start: string; end: string }
): boolean {
  const ar = getShiftRange(a.date, a.start, a.end);
  const br = getShiftRange(b.date, b.start, b.end);
  return ar.start < br.end && br.start < ar.end;
}

async function getOrgIdForShift(shiftId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: scheduleWeeks.orgId })
    .from(scheduledShifts)
    .innerJoin(scheduleWeeks, eq(scheduledShifts.weekId, scheduleWeeks.id))
    .where(eq(scheduledShifts.id, shiftId));
  return row?.orgId ?? null;
}

export const swapsService = {
  // Все запросы организации (для админа)
  async list(orgId: string) {
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));

    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .orderBy(desc(shiftSwapRequests.createdAt));

    const filtered = rows.filter(
      (r) =>
        orgUserIds.has(r.requestedBy) ||
        (r.swapWithUserId && orgUserIds.has(r.swapWithUserId))
    );
    return enrichSwaps(filtered);
  },

  // Мои исходящие
  async outgoing(userId: string) {
    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.requestedBy, userId))
      .orderBy(desc(shiftSwapRequests.createdAt));
    return enrichSwaps(rows);
  },

  // Входящие мне (только адресные)
  async incoming(userId: string) {
    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .where(
        and(
          eq(shiftSwapRequests.status, "PENDING"),
          eq(shiftSwapRequests.swapWithUserId, userId)
        )
      )
      .orderBy(desc(shiftSwapRequests.createdAt));
    return enrichSwaps(rows);
  },

  // Доступные мне (открытые + адресные, где я не автор)
  async available(userId: string, orgId: string) {
    // Получаем список всех сотрудников этой организации
    const orgUsers = await db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));
    const orgUserIds = new Set(orgUsers.map((u) => u.id));

    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .where(
        and(
          eq(shiftSwapRequests.status, "PENDING"),
          ne(shiftSwapRequests.requestedBy, userId)
        )
      )
      .orderBy(desc(shiftSwapRequests.createdAt));

    // Оставляем только обмены от коллег из этой же организации
    const filtered = rows.filter(
      (r) => orgUserIds.has(r.requestedBy) && (!r.swapWithUserId || r.swapWithUserId === userId)
    );
    return enrichSwaps(filtered);
  },

  async availableCount(userId: string, orgId: string) {
    const all = await this.available(userId, orgId);
    return { count: all.length };
  },

  async create(input: {
    orgId: string;
    requestedBy: string;
    shiftId: string;
    swapWithUserId?: string;
  }) {
    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, input.shiftId));
    if (!shift) throw new Error("SHIFT_NOT_FOUND");
    if (shift.userId !== input.requestedBy) throw new Error("NOT_YOUR_SHIFT");

    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(eq(scheduleWeeks.id, shift.weekId));
    if (!week || week.orgId !== input.orgId) throw new Error("SHIFT_NOT_FOUND");

    const shiftDateStr = String(shift.shiftDate).slice(0, 10);

    if (input.swapWithUserId) {
      const [target] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, input.swapWithUserId),
            eq(users.orgId, input.orgId)
          )
        );
      if (!target) throw new Error("USER_NOT_FOUND");
      if (target.id === input.requestedBy) throw new Error("SELF_SWAP");

      // Ищем смены target за вчера, сегодня и завтра (для учета ночных)
      const yesterday = new Date(shiftDateStr + "T00:00:00Z");
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const tomorrow = new Date(shiftDateStr + "T00:00:00Z");
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const targetShifts = await db
        .select()
        .from(scheduledShifts)
        .where(
          and(
            eq(scheduledShifts.userId, input.swapWithUserId),
            gte(scheduledShifts.shiftDate, yesterday.toISOString().slice(0, 10)),
            lte(scheduledShifts.shiftDate, tomorrow.toISOString().slice(0, 10))
          )
        );

      const newShift = {
        date: shiftDateStr,
        start: shift.startTime,
        end: shift.endTime,
      };
      
      const conflict = targetShifts.find((s) =>
        shiftsOverlapSafe(newShift, {
          date: String(s.shiftDate).slice(0, 10),
          start: s.startTime,
          end: s.endTime,
        })
      );
      if (conflict) throw new Error("TARGET_BUSY");
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

    const [requester] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.requestedBy));

    const isTargeted = !!input.swapWithUserId;
    let recipientIds: string[] = [];
    if (isTargeted) {
      recipientIds = [input.swapWithUserId!];
    } else {
      const others = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.orgId, input.orgId),
            ne(users.id, input.requestedBy),
            notInArray(users.role, ["OWNER", "MANAGER"])
          )
        );
      recipientIds = others.map((u) => u.id);
    }

    for (const rid of recipientIds) {
      await notificationsService.create({
        orgId: input.orgId,
        userId: rid,
        kind: isTargeted ? "SWAP_OFFER" : "SWAP_OPEN",
        title: isTargeted ? "Предложение обмена" : "Открытый обмен",
        message:
          `${requester?.name ?? "Сотрудник"} ` +
          (isTargeted
            ? `предлагает вам обменяться сменами: ${shiftDateStr}, ${shift.startTime}–${shift.endTime}`
            : `ищет замену на смену: ${shiftDateStr}, ${shift.startTime}–${shift.endTime}`),
        relatedId: request.id,
        relatedType: "swap_request",
        requiresAction: true,
        payload: { shiftId: input.shiftId, date: shiftDateStr },
      });
    }

    // Уведомление менеджерам при создании НЕ отправляем —
    // они получат уведомление только когда обмен примут (SWAP_ACCEPTED_MANAGER).

    return request;
  },

  async accept(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");
    if (req.swapWithUserId && req.swapWithUserId !== userId)
      throw new Error("NOT_FOR_YOU");

    const orgId = await getOrgIdForShift(req.shiftId);
    if (!orgId) throw new Error("ORG_NOT_FOUND");

    // 🛡️ ТРАНЗАКЦИЯ: Все изменения в БД применяются атомарно (либо всё, либо ничего)
    const updated = await db.transaction(async (tx) => {
      const [shift] = await tx
        .update(scheduledShifts)
        .set({ userId })
        .where(eq(scheduledShifts.id, req.shiftId))
        .returning();

      const [updatedReq] = await tx
        .update(shiftSwapRequests)
        .set({ status: "APPROVED", swapWithUserId: userId })
        .where(eq(shiftSwapRequests.id, id))
        .returning();

      // Отменяем остальные PENDING на этот shift
      const otherSwaps = await tx
        .select()
        .from(shiftSwapRequests)
        .where(
          and(
            eq(shiftSwapRequests.shiftId, req.shiftId),
            eq(shiftSwapRequests.status, "PENDING")
          )
        );
      
      for (const other of otherSwaps) {
        if (other.id === id) continue;
        await tx
          .update(shiftSwapRequests)
          .set({ status: "DENIED" })
          .where(eq(shiftSwapRequests.id, other.id));
      }

      // Запоминаем shift для использования вне транзакции
      return { shift, updatedReq, otherSwaps };
    });

    for (const other of updated.otherSwaps) {
      if (other.id === id) continue;
      await notificationsService.dismissActionable(other.id, "swap_request");
    }
    
    const shift = updated.shift;

    const [requester] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, req.requestedBy));
    const [accepter] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    const shiftDateStr = shift ? String(shift.shiftDate).slice(0, 10) : "";

    await notificationsService.resolveActionable(
      id,
      "swap_request",
      "APPROVED",
      accepter?.name ?? "Сотрудник",
      `принял(а) обмен смены на ${shiftDateStr}`
    );

    if (req.requestedBy !== userId) {
      await notificationsService.create({
        orgId,
        userId: req.requestedBy,
        kind: "SWAP_ACCEPTED",
        title: "Обмен принят",
        message: `${accepter?.name ?? "Сотрудник"} принял(а) ваш обмен смены на ${shiftDateStr}`,
        relatedId: id,
        relatedType: "swap_request",
        requiresAction: false,
      });
    }

    await notificationsService.notifyManagers({
      orgId,
      kind: "SWAP_ACCEPTED_MANAGER",
      title: "Обмен смены",
      message: `${accepter?.name ?? "Сотрудник"} принял(а) обмен смены от ${requester?.name ?? "Сотрудник"} на ${shiftDateStr}`,
      relatedId: id,
      relatedType: "swap_request",
      requiresAction: false,
      excludeUserId: userId,
    });

    return updated.updatedReq;
  },

  async decline(id: string, userId: string) {
    const [req] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, id));
    if (!req) throw new Error("NOT_FOUND");
    if (req.status !== "PENDING") throw new Error("NOT_PENDING");
    if (req.swapWithUserId && req.swapWithUserId !== userId)
      throw new Error("NOT_FOR_YOU");

    const orgId = await getOrgIdForShift(req.shiftId);
    if (!orgId) throw new Error("ORG_NOT_FOUND");

    const [shift] = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.id, req.shiftId));
    const shiftDateStr = shift ? String(shift.shiftDate).slice(0, 10) : "";

    const [decliner] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));

    // ВСЕГДА ставим статус DENIED (даже для открытых)
    const [updated] = await db
      .update(shiftSwapRequests)
      .set({ status: "DENIED" })
      .where(eq(shiftSwapRequests.id, id))
      .returning();

    await notificationsService.resolveActionable(
      id,
      "swap_request",
      "REJECTED",
      decliner?.name ?? "Сотрудник",
      `отклонил(а) обмен смены на ${shiftDateStr}`
    );

    // Уведомляем автора (если это не он сам)
    if (req.requestedBy !== userId) {
      await notificationsService.create({
        orgId,
        userId: req.requestedBy,
        kind: "SWAP_DECLINED",
        title: "Обмен отклонён",
        message: `${decliner?.name ?? "Сотрудник"} отклонил(а) ваш обмен смены на ${shiftDateStr}`,
        relatedId: id,
        relatedType: "swap_request",
        requiresAction: false,
      });
    }

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
    await notificationsService.dismissActionable(id, "swap_request");

    return { success: true };
  },
};
