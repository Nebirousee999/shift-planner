import { eq, and, lte, gte, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { vacations, users } from "../../../db/schema.js";
import { notificationsService } from "../notifications/notifications.service.js";

export const vacationsService = {
  async list(orgId: string) {
    const rows = await db
      .select()
      .from(vacations)
      .where(eq(vacations.orgId, orgId))
      .orderBy(vacations.startDate);

    const userMap = new Map(
      (await db.select({ id: users.id, name: users.name }).from(users)).map(
        (u) => [u.id, u.name]
      )
    );

    return rows.map((r) => ({
      ...r,
      userName: userMap.get(r.userId) ?? "—",
    }));
  },

  async mine(userId: string) {
    return db
      .select()
      .from(vacations)
      .where(eq(vacations.userId, userId))
      .orderBy(vacations.startDate);
  },

  async check(userId: string, date: string, orgId: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    if (!user) return null;

    const [found] = await db
      .select()
      .from(vacations)
      .where(
        and(
          eq(vacations.userId, userId),
          eq(vacations.status, "APPROVED"),
          lte(vacations.startDate, date),
          gte(vacations.endDate, date)
        )
      );

    return found ?? null;
  },

  async create(input: {
    orgId: string;
    userId: string;
    startDate: string;
    endDate: string;
    comment?: string;
    requesterRole: string;
  }) {
    if (input.startDate > input.endDate) throw new Error("INVALID_DATES");

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    const isManager =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    const status = isManager ? "APPROVED" : "PENDING";

    const [created] = await db
      .insert(vacations)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        comment: input.comment,
        status,
      })
      .returning();

    if (status === "PENDING") {
      await notificationsService.notifyManagers({
        orgId: input.orgId,
        kind: "VACATION_REQUEST",
        title: "Запрос отпуска",
        message: `${user.name} просит отпуск с ${input.startDate} по ${input.endDate}${input.comment ? `. ${input.comment}` : ""}`,
        relatedId: created.id,
        relatedType: "vacation_request",
        requiresAction: true,
        payload: {
          startDate: input.startDate,
          endDate: input.endDate,
          userName: user.name,
        },
        excludeUserId: input.userId,
      });
    }

    return created;
  },

  async update(input: {
    id: string;
    orgId: string;
    requesterId: string;
    requesterRole: string;
    startDate?: string;
    endDate?: string;
    comment?: string | null;
  }) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, input.id), eq(vacations.orgId, input.orgId)));
    if (!vac) throw new Error("NOT_FOUND");

    const isAdmin =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    if (!isAdmin && vac.userId !== input.requesterId) throw new Error("FORBIDDEN");

    const newStart = input.startDate ?? String(vac.startDate);
    const newEnd = input.endDate ?? String(vac.endDate);
    if (newStart > newEnd) throw new Error("INVALID_DATES");

    if (isAdmin) {
      const [updated] = await db
        .update(vacations)
        .set({
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.endDate !== undefined && { endDate: input.endDate }),
          ...(input.comment !== undefined && { comment: input.comment }),
          status: "APPROVED",
          previousStartDate: null,
          previousEndDate: null,
          previousComment: null,
          reviewedBy: input.requesterId,
          reviewedAt: new Date(),
        })
        .where(eq(vacations.id, input.id))
        .returning();

      if (vac.userId !== input.requesterId) {
        await notificationsService.create({
          orgId: input.orgId,
          userId: vac.userId,
          kind: "VACATION_UPDATED_BY_MANAGER",
          title: "Ваш отпуск изменён",
          message: `Руководитель изменил отпуск: ${newStart} — ${newEnd}`,
          relatedId: input.id,
          relatedType: "vacation",
          requiresAction: false,
        });
      }

      return updated;
    }

    const [updated] = await db
      .update(vacations)
      .set({
        startDate: newStart,
        endDate: newEnd,
        comment: input.comment !== undefined ? input.comment : vac.comment,
        status: "PENDING",
        previousStartDate: vac.previousStartDate ?? vac.startDate,
        previousEndDate: vac.previousEndDate ?? vac.endDate,
        previousComment: vac.previousComment ?? vac.comment,
      })
      .where(eq(vacations.id, input.id))
      .returning();

    const [u] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.requesterId));

    await notificationsService.notifyManagers({
      orgId: input.orgId,
      kind: "VACATION_EDIT_REQUEST",
      title: "Изменение отпуска",
      message: `${u?.name ?? "Сотрудник"} изменил(а) свой отпуск: ${newStart} — ${newEnd}`,
      relatedId: input.id,
      relatedType: "vacation_request",
      requiresAction: true,
      payload: { startDate: newStart, endDate: newEnd, userName: u?.name },
      excludeUserId: input.requesterId,
    });

    return updated;
  },

  async remove(input: {
    id: string;
    orgId: string;
    requesterId: string;
    requesterRole: string;
  }) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, input.id), eq(vacations.orgId, input.orgId)));
    if (!vac) throw new Error("NOT_FOUND");

    const isAdmin =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    if (!isAdmin && vac.userId !== input.requesterId) throw new Error("FORBIDDEN");

    await db.delete(vacations).where(eq(vacations.id, input.id));
    return { success: true };
  },

  async listPending(orgId: string) {
    const rows = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.orgId, orgId), eq(vacations.status, "PENDING")))
      .orderBy(desc(vacations.createdAt));

    const userMap = new Map(
      (await db.select({ id: users.id, name: users.name }).from(users)).map(
        (u) => [u.id, u.name]
      )
    );

    return rows.map((r) => ({
      ...r,
      userName: userMap.get(r.userId) ?? "—",
    }));
  },

  async pendingCount(orgId: string) {
    const rows = await db
      .select({ id: vacations.id })
      .from(vacations)
      .where(and(eq(vacations.orgId, orgId), eq(vacations.status, "PENDING")));
    return { count: rows.length };
  },

  async approve(id: string, orgId: string, reviewerId: string) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, id), eq(vacations.orgId, orgId)));
    if (!vac) throw new Error("NOT_FOUND");
    if (vac.status !== "PENDING") throw new Error("NOT_PENDING");

    const [updated] = await db
      .update(vacations)
      .set({
        status: "APPROVED",
        previousStartDate: null,
        previousEndDate: null,
        previousComment: null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(vacations.id, id))
      .returning();

    // Убираем action-required карточки из колокольчика у всех менеджеров
    const [reviewer] = await db
                 .select({ name: users.name })
                 .from(users)
                 .where(eq(users.id, reviewerId));

               await notificationsService.resolveActionable(
                 id,
                 "vacation_request",
                 "APPROVED",
                 reviewer?.name ?? "Руководитель",
                 `отпуск ${String(updated.startDate).slice(0, 10)} — ${String(updated.endDate).slice(0, 10)} одобрен`
               );

    await notificationsService.create({
      orgId,
      userId: vac.userId,
      kind: "VACATION_APPROVED",
      title: "Отпуск одобрен",
      message: `Ваш отпуск одобрен: ${String(updated.startDate).slice(0, 10)} — ${String(updated.endDate).slice(0, 10)}`,
      relatedId: id,
      relatedType: "vacation",
      requiresAction: false,
    });

    return updated;
  },

  async reject(id: string, orgId: string, reviewerId: string) {
    const [vac] = await db
      .select()
      .from(vacations)
      .where(and(eq(vacations.id, id), eq(vacations.orgId, orgId)));
    if (!vac) throw new Error("NOT_FOUND");
    if (vac.status !== "PENDING") throw new Error("NOT_PENDING");

    const [updated] = await db
      .update(vacations)
      .set({
        startDate: vac.previousStartDate ?? vac.startDate,
        endDate: vac.previousEndDate ?? vac.endDate,
        comment: vac.previousComment ?? vac.comment,
        status: "APPROVED",
        previousStartDate: null,
        previousEndDate: null,
        previousComment: null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(vacations.id, id))
      .returning();

    const [reviewer] = await db
                 .select({ name: users.name })
                 .from(users)
                 .where(eq(users.id, reviewerId));

               await notificationsService.resolveActionable(
                 id,
                 "vacation_request",
                 "REJECTED",
                 reviewer?.name ?? "Руководитель",
                 "изменение отпуска отклонено"
               );

    await notificationsService.create({
      orgId,
      userId: vac.userId,
      kind: "VACATION_REJECTED",
      title: "Изменение отпуска отклонено",
      message: "Ваш запрос на изменение отпуска отклонён",
      relatedId: id,
      relatedType: "vacation",
      requiresAction: false,
    });

    return updated;
  },
};
