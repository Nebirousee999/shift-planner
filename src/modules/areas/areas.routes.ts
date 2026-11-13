import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { areasService } from "./areas.service.js";

const createSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

const copySchema = z.object({
  areaIds: z.array(z.string().uuid()).min(1).max(500),
  targetLocationId: z.string().uuid(),
});

export async function areasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    const q = req.query as { locationId?: string };
    return areasService.list(orgId, q.locationId);
  });

  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { orgId } = req.user!;
      return await areasService.create({ orgId, ...parsed.data });
    } catch (e: any) {
      if (e.message === "NAME_REQUIRED")
        return reply.code(400).send({ error: "Название обязательно" });
      if (e.message === "LOCATION_NOT_FOUND")
        return reply.code(404).send({ error: "Точка не найдена" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания" });
    }
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = z.object({ name: z.string().min(1).max(255) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректное имя" });
    
    try {
      const { orgId } = req.user!;
      return await areasService.update(req.params.id, orgId, parsed.data.name);
    } catch (e: any) {
      if (e.message === "NOT_FOUND") return reply.code(404).send({ error: "Локация не найдена" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка обновления" });
    }
  });

  app.post("/copy", async (req, reply) => {
    const parsed = copySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { orgId } = req.user!;
      return await areasService.copy({ orgId, ...parsed.data });
    } catch (e: any) {
      if (e.message === "LOCATION_NOT_FOUND")
        return reply.code(404).send({ error: "Целевая точка не найдена" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка копирования" });
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { orgId } = req.user!;
    const deleted = await areasService.remove(req.params.id, orgId);
    if (!deleted) return reply.code(404).send({ error: "Локация не найдена" });
    return { success: true };
  });
}