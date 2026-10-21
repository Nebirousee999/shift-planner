import { eq, and, lte, gte, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { sickLeaves, users } from "../../../db/schema.js";

export const sickLeavesService = {
  async list(orgId: string) {
    const rows = await db.select().from(sickLeaves).where(eq(sickLeaves.orgId, orgId)).orderBy(desc(sickLeaves.startDate));
    const userMap = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...r, userName: userMap.get(r.userId) ?? "—" }));
  },

  async create(input: { orgId: string; userId: string; startDate: string; endDate: string; comment?: string }) {
    const [created] = await db.insert(sickLeaves).values({
      orgId: input.orgId,
      userId: input.userId,
      startDate: input.startDate,
      endDate: input.endDate,
      comment: input.comment,
      status: "APPROVED", // Больничный не требует согласования, это факт
    }).returning();
    return created;
  },

  async remove(id: string, orgId: string) {
    await db.delete(sickLeaves).where(and(eq(sickLeaves.id, id), eq(sickLeaves.orgId, orgId)));
    return { success: true };
  },

  async check(userId: string, date: string, orgId: string) {
    const [found] = await db.select().from(sickLeaves).where(
      and(eq(sickLeaves.userId, userId), eq(sickLeaves.orgId, orgId), lte(sickLeaves.startDate, date), gte(sickLeaves.endDate, date))
    );
    return found ?? null;
  }
};