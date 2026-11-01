import { eq, and, lte, gte, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { sickLeaves, users } from "../../../db/schema.js";
import { messengerService } from "../../lib/messenger.service.js";
import { notificationsService } from "../notifications/notifications.service.js";

function formatMoscow(d: Date): string {
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

export const sickLeavesService = {
  async list(orgId: string) {
    const rows = await db
      .select()
      .from(sickLeaves)
      .where(eq(sickLeaves.orgId, orgId))
      .orderBy(desc(sickLeaves.startDate));

    const orgUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.orgId, orgId));
    const userMap = new Map(orgUsers.map((u) => [u.id, u.name]));

    return rows.map((r) => ({
      ...r,
      userName: userMap.get(r.userId) ?? "—",
      createdByName: r.createdById ? userMap.get(r.createdById) ?? null : null,
      updatedByName: r.updatedById ? userMap.get(r.updatedById) ?? null : null,
    }));
  },

  async listMine(userId: string) {
    const rows = await db
      .select()
      .from(sickLeaves)
      .where(eq(sickLeaves.userId, userId))
      .orderBy(desc(sickLeaves.startDate));
    return rows;
  },

  async create(input: {
    orgId: string;
    userId: string;
    startDate: string;
    endDate: string;
    comment?: string;
    createdById: string;
  }) {
    const [created] = await db
      .insert(sickLeaves)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        comment: input.comment,
        status: "APPROVED",
        createdById: input.createdById,
      })
      .returning();

    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.createdById));
    const who = creator?.name ?? "Руководитель";
    const nowStr = formatMoscow(new Date());

    await messengerService.sendToUser(
      input.userId,
      `<b>Больничный</b>\n\n${who} добавил(а) вам больничный с <b>${input.startDate}</b> по <b>${input.endDate}</b>.\n${input.comment ? `Комментарий: ${input.comment}\n` : ""}\nСоздано: ${nowStr}\n\nНажмите «ОК», чтобы подтвердить.`
    );

    if (input.userId !== input.createdById) {
      await notificationsService.create({
        orgId: input.orgId,
        userId: input.userId,
        kind: "SICK_LEAVE_CREATED",
        title: "Больничный",
        message: `${who} добавил(а) вам больничный с ${input.startDate} по ${input.endDate}`,
        relatedId: created.id,
        relatedType: "sick_leave",
        requiresAction: false,
      });
    }

    return created;
  },

  async update(input: {
    id: string;
    orgId: string;
    updatedById: string;
    startDate?: string;
    endDate?: string;
    comment?: string | null;
  }) {
    const [existing] = await db
      .select()
      .from(sickLeaves)
      .where(and(eq(sickLeaves.id, input.id), eq(sickLeaves.orgId, input.orgId)));
    if (!existing) return null;

    const [updated] = await db
      .update(sickLeaves)
      .set({
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.comment !== undefined && { comment: input.comment }),
        updatedAt: new Date(),
        updatedById: input.updatedById,
      })
      .where(eq(sickLeaves.id, input.id))
      .returning();

    const [updater] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.updatedById));
    const who = updater?.name ?? "Руководитель";
    const nowStr = formatMoscow(new Date());

    await messengerService.sendToUser(
      updated.userId,
      `<b>Больничный изменён</b>\n\n${who} изменил(а) ваш больничный.\nНовые даты: <b>${String(updated.startDate).slice(0, 10)}</b> — <b>${String(updated.endDate).slice(0, 10)}</b>.\n\nИзменено: ${nowStr}`
    );

    if (updated.userId !== input.updatedById) {
      await notificationsService.create({
        orgId: input.orgId,
        userId: updated.userId,
        kind: "SICK_LEAVE_UPDATED",
        title: "Больничный изменён",
        message: `Больничный изменён: ${String(updated.startDate).slice(0, 10)} — ${String(updated.endDate).slice(0, 10)}`,
        relatedId: input.id,
        relatedType: "sick_leave",
        requiresAction: false,
      });
    }

    return updated;
  },

  async remove(id: string, orgId: string) {
    await db.delete(sickLeaves).where(
      and(eq(sickLeaves.id, id), eq(sickLeaves.orgId, orgId))
    );
    return { success: true };
  },

  async check(userId: string, date: string, orgId: string) {
    const [found] = await db
      .select()
      .from(sickLeaves)
      .where(
        and(
          eq(sickLeaves.userId, userId),
          eq(sickLeaves.orgId, orgId),
          lte(sickLeaves.startDate, date),
          gte(sickLeaves.endDate, date)
        )
      );
    return found ?? null;
  },
};
