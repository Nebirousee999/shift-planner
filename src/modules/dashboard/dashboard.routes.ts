import type { FastifyInstance } from "fastify";
import { dashboardService } from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    const q = req.query as { locationId?: string };
    return dashboardService.summary(orgId, q.locationId);
  });
}