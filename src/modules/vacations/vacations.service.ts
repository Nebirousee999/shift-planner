import { eq, and, lte, gte } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { vacations, users } from "../../../db/schema.js";

export const vacationsService = {
  // Все отпуска организации (для страницы /vacations)
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

  // Мои отпуска
  async mine(userId: string) {
    return db
      .select()
      .from(vacations)
      .where(eq(vacations.userId, userId))
      .orderBy(vacations.startDate);
  },

  // Проверка: есть ли отпуск у сотрудника на конкретную дату
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
  }) {
    if (input.startDate > input.endDate) {
      throw new Error("INVALID_DATES");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, input.userId), eq(users.orgId, input.orgId))
      );
    if (!user) throw new Error("USER_NOT_FOUND");

    const [created] = await db
      .insert(vacations)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        comment: input.comment,
      })
      .returning();
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
      .where(
        and(eq(vacations.id, input.id), eq(vacations.orgId, input.orgId))
      );
    if (!vac) throw new Error("NOT_FOUND");

    const isAdmin =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    if (!isAdmin && vac.userId !== input.requesterId) {
      throw new Error("FORBIDDEN");
    }

    const newStart = input.startDate ?? vac.startDate;
    const newEnd = input.endDate ?? vac.endDate;
    if (String(newStart) > String(newEnd)) {
      throw new Error("INVALID_DATES");
    }

    const [updated] = await db
      .update(vacations)
      .set({
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.comment !== undefined && { comment: input.comment }),
      })
      .where(eq(vacations.id, input.id))
      .returning();
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
      .where(
        and(eq(vacations.id, input.id), eq(vacations.orgId, input.orgId))
      );
    if (!vac) throw new Error("NOT_FOUND");

    const isAdmin =
      input.requesterRole === "OWNER" || input.requesterRole === "MANAGER";
    if (!isAdmin && vac.userId !== input.requesterId) {
      throw new Error("FORBIDDEN");
    }

    await db.delete(vacations).where(eq(vacations.id, input.id));
    return { success: true };
  },
};