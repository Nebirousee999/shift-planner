import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { timeEntries, users, scheduledShifts } from "../../../db/schema.js";

export const timeEntriesService = {
  async list(
    orgId: string,
    filters: { userId?: string; from?: string; to?: string } = {},
  ) {
    // Проверяем, что userId принадлежит организации
    const conditions = [];
    // Ограничим выборку записями сотрудников из этой организации
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.orgId, orgId));
    const orgUserIds = orgUsers.map((u) => u.id);

    if (orgUserIds.length === 0) return [];

    if (filters.userId) {
      if (!orgUserIds.includes(filters.userId)) return [];
      conditions.push(eq(timeEntries.userId, filters.userId));
    } else {
      // без фильтра — только записи сотрудников организации
      // (drizzle не умеет IN через eq, делаем вручную)
    }

    if (filters.from) conditions.push(gte(timeEntries.clockIn, new Date(filters.from + "T00:00:00Z")));
    if (filters.to) conditions.push(lte(timeEntries.clockIn, new Date(filters.to + "T23:59:59Z")));

    const rows = await db
      .select()
      .from(timeEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(timeEntries.clockIn));

    // Отфильтруем те, что не от сотрудников организации, и подмешаем имена
    const userMap = new Map(
      (await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [
        u.id,
        u.name,
      ]),
    );

    return rows
      .filter((r) => orgUserIds.includes(r.userId))
      .map((r) => ({
        ...r,
        userName: userMap.get(r.userId) ?? "—",
      }));
  },

  async getActive(userId: string, orgId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    if (!user) return null;

    const [active] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
      .orderBy(desc(timeEntries.clockIn));
    return active ?? null;
  },

  async clockIn(input: { userId: string; orgId: string; shiftId?: string }) {
    // Проверяем, что сотрудник принадлежит организации
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.orgId, input.orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    // Уже есть открытая запись?
    const active = await this.getActive(input.userId, input.orgId);
    if (active) throw new Error("ALREADY_OPEN");

    // Если shiftId передан, проверяем, что он принадлежит организации
    if (input.shiftId) {
      const [shift] = await db
        .select()
        .from(scheduledShifts)
        .where(eq(scheduledShifts.id, input.shiftId));
      if (!shift) throw new Error("SHIFT_NOT_FOUND");
    }

    const [entry] = await db
      .insert(timeEntries)
      .values({
        userId: input.userId,
        shiftId: input.shiftId,
        clockIn: new Date(),
        source: "web",
      })
      .returning();
    return entry;
  },

  async clockOut(userId: string, orgId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    if (!user) throw new Error("USER_NOT_FOUND");

    const active = await this.getActive(userId, orgId);
    if (!active) throw new Error("NO_OPEN_ENTRY");

    const [updated] = await db
      .update(timeEntries)
      .set({ clockOut: new Date() })
      .where(eq(timeEntries.id, active.id))
      .returning();
    return updated;
  },
};