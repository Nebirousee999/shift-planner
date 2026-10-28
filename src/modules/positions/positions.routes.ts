import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { positionsService } from "./positions.service.js";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function positionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return positionsService.list(orgId);
  });

  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { orgId } = req.user!;
      return await positionsService.create({ orgId, ...parsed.data });
    } catch (e: any) {
      if (e.message === "NAME_REQUIRED")
        return reply.code(400).send({ error: "Название обязательно" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания" });
    }
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = req.user!;
    const updated = await positionsService.update(req.params.id, orgId, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Должность не найдена" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { orgId } = req.user!;
    const deleted = await positionsService.remove(req.params.id, orgId);
    if (!deleted) return reply.code(404).send({ error: "Должность не найдена" });
    return { success: true };
  });
}