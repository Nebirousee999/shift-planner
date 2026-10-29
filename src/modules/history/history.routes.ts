import type { FastifyInstance } from "fastify";
import { historyService } from "./history.service.js";

export async function historyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    const q = req.query as { from?: string; to?: string; type?: string };
    return historyService.list(orgId, q.from, q.to, q.type);
  });
}