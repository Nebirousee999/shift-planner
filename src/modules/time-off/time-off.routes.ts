import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { timeOffService } from "./time-off.service.js";

export async function timeOffRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return timeOffService.list(orgId);
  });

  app.post("/", async (req, reply) => {
    const { orgId, sub: userId } = req.user!;
    const parsed = z.object({
      shiftId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      comment: z.string().max(255).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    return timeOffService.create({ orgId, userId, ...parsed.data });
  });

  app.post("/:id/approve", async (req, reply) => {
    const { orgId, sub: userId } = req.user!;
    try {
      return await timeOffService.approve((req.params as any).id, orgId, userId);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post("/:id/reject", async (req, reply) => {
    const { orgId, sub: userId } = req.user!;
    try {
      return await timeOffService.reject((req.params as any).id, orgId, userId);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });
}