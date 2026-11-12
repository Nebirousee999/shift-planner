import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { users, organizations } from "../../../db/schema.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER"]));

  app.get("/db-info", async (req, reply) => {
    const { sub: userId } = req.user!;
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    
    // 🔒 Строгая проверка на супер-админа
    const superAdmin = process.env.ADMIN_EMAIL || "prihodko999@inbox.ru";
    if (user?.email !== superAdmin) {
      return reply.code(403).send({ error: "Доступ только для администратора сервиса" });
    }

    const allOrgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const allUsers = await db.select().from(users);

    const result = allOrgs.map((org) => {
      const orgUsers = allUsers.filter((u) => u.orgId === org.id);
      const owner = orgUsers.find((u) => u.role === "OWNER");
      
      // Считаем только реальных сотрудников (не владельца и не менеджеров, если хочешь чисто рядовых - поменяй условие)
      const employeeCount = orgUsers.filter((u) => u.role === "EMPLOYEE" || u.role === "MANAGER").length;

      const now = new Date();
      let tariff = "Free";
      let expiresAt = null;

      if (org.tariffExpiresAt && new Date(org.tariffExpiresAt) > now) {
        tariff = org.tariffId === "business" ? "Business" : "Pro";
        expiresAt = org.tariffExpiresAt;
      } else if (org.trialEndsAt && new Date(org.trialEndsAt) > now) {
        tariff = "Trial (Pro)";
        expiresAt = org.trialEndsAt;
      }

      return {
        id: org.id,
        orgName: org.name,
        email: owner?.email || "—",
        createdAt: org.createdAt,
        tariff,
        expiresAt,
        employeeCount,
      };
    });

    return result;
  });
}
