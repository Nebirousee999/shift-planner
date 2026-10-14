import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { analyticsService } from "./analytics.service.js";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    return analyticsService.summary(orgId, parsed.data.from, parsed.data.to);
  });
}