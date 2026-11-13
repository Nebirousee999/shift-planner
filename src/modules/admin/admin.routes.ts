import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { users, organizations } from "../../../db/schema.js";
import { usersService } from "../users/users.service.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER"]));

  // ─── Получение списка ВСЕХ пользователей ───
  app.get("/db-info", async (req, reply) => {
    const { sub: userId } = req.user!;
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    
    const superAdmin = process.env.ADMIN_EMAIL || "prihodko999@inbox.ru";
    if (user?.email !== superAdmin) {
      return reply.code(403).send({ error: "Доступ только для администратора сервиса" });
    }

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allOrgs = await db.select().from(organizations);
    const orgMap = new Map(allOrgs.map(o => [o.id, o.name]));

    return allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      orgName: orgMap.get(u.orgId) || "—",
      createdAt: u.createdAt,
    }));
  });

  // ─── Массовое удаление пользователей ───
  app.delete("/users", async (req, reply) => {
    const { sub: adminId } = req.user!;
    const [admin] = await db.select({ email: users.email }).from(users).where(eq(users.id, adminId));
    
    const superAdmin = process.env.ADMIN_EMAIL || "prihodko999@inbox.ru";
    if (admin?.email !== superAdmin) {
      return reply.code(403).send({ error: "Доступ только для администратора сервиса" });
    }

    const { userIds } = req.body as { userIds: string[] };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return reply.code(400).send({ error: "Нет ID для удаления" });
    }

    let deletedCount = 0;
    for (const id of userIds) {
      const [targetUser] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, id));
      if (targetUser) {
        try {
          await usersService.remove(id, targetUser.orgId, adminId);
          deletedCount++;
        } catch (e) {
          console.error("Admin delete error for user", id, e);
        }
      }
    }
    return { success: true, deletedCount };
  });
}
