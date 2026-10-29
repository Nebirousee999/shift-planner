import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sickLeavesService } from "./sick-leaves.service.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function sickLeavesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return sickLeavesService.list(orgId);
  });

  app.post("/", async (req, reply) => {
    const parsed = z.object({
      userId: z.string().uuid(),
      startDate: z.string().regex(dateRegex),
      endDate: z.string().regex(dateRegex),
      comment: z.string().max(255).optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId, sub: requesterId } = req.user!;
    return sickLeavesService.create({
      orgId,
      createdById: requesterId,
      ...parsed.data,
    });
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = z.object({
      startDate: z.string().regex(dateRegex).optional(),
      endDate: z.string().regex(dateRegex).optional(),
      comment: z.string().max(255).nullable().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId, sub: requesterId } = req.user!;
    const updated = await sickLeavesService.update({
      id: req.params.id,
      orgId,
      updatedById: requesterId,
      ...parsed.data,
    });
    if (!updated) return reply.code(404).send({ error: "Больничный не найден" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { orgId } = req.user!;
    await sickLeavesService.remove(req.params.id, orgId);
    return { success: true };
  });
}