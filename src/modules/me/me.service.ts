import { eq, and, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../../../db/client.js";
import {
  users,
  scheduledShifts,
  scheduleWeeks,
  shiftTemplates,
} from "../../../db/schema.js";

export const meService = {
  async profile(userId: string, orgId: string) {
    const [u] = await db
      .select({
        id: users.id,
        orgId: users.orgId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,       // ← НОВОЕ
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    return u ?? null;
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("USER_NOT_FOUND");

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new Error("WRONG_PASSWORD");

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
  },

  async myShifts(
    userId: string,
    orgId: string,
    filters: { from?: string; to?: string } = {},
  ) {
    // проверяем принадлежность организации
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    if (!u) throw new Error("USER_NOT_FOUND");

    const conditions = [eq(scheduledShifts.userId, userId)];
    if (filters.from) conditions.push(gte(scheduledShifts.shiftDate, filters.from));
    if (filters.to) conditions.push(lte(scheduledShifts.shiftDate, filters.to));

    const rows = await db
      .select()
      .from(scheduledShifts)
      .where(and(...conditions))
      .orderBy(scheduledShifts.shiftDate, scheduledShifts.startTime);

    // подмешиваем имя шаблона и статус недели
    const tpls = await db
      .select({ id: shiftTemplates.id, name: shiftTemplates.name })
      .from(shiftTemplates);
    const tMap = new Map(tpls.map((t) => [t.id, t.name]));

    const weeks = await db
      .select({ id: scheduleWeeks.id, status: scheduleWeeks.status })
      .from(scheduleWeeks);
    const wMap = new Map(weeks.map((w) => [w.id, w.status]));

    return rows.map((r) => ({
      ...r,
      templateName: r.templateId ? tMap.get(r.templateId) ?? null : null,
      weekStatus: wMap.get(r.weekId) ?? null,
    }));
  },

  // Коллеги по организации — минимальный набор полей
  async colleagues(orgId: string) {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,       // ← НОВОЕ
      })
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(users.name);
  },

};