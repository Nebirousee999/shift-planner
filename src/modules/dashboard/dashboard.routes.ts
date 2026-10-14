import type { FastifyInstance } from "fastify";
import { dashboardService } from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return dashboardService.summary(orgId);
  });
}