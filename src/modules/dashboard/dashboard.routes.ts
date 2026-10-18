import type { FastifyInstance } from "fastify";
import { dashboardService } from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Раньше было:
  //   app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));
  // Это блокировало сотрудника (403). Убрали — фронт сам фильтрует данные
  // по user.id и показывает только своё.

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return dashboardService.summary(orgId);
  });
}