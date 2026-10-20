import type { FastifyInstance } from "fastify";
import { dashboardService } from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    const query = req.query as { date?: string };
    return dashboardService.summary(orgId, query.date);
  });
}