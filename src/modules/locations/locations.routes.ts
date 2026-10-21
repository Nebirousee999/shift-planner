import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { locationsService } from "./locations.service.js";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
});

const updateSchema = createSchema.partial();
const setEmployeesSchema = z.object({ userIds: z.array(z.string().uuid()) });

export async function locationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return locationsService.list(orgId);
  });

  app.post("/", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const { orgId } = req.user!;
      return await locationsService.create({ orgId, ...parsed.data });
    } catch (e: any) {
      if (e.message === "LOCATION_LIMIT_REACHED") {
        return reply.code(403).send({
          error: "Достигнут лимит точек на вашем тарифе",
          code: "LOCATION_LIMIT_REACHED",
        });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания точки" });
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: app.requireRole(["OWNER"]) },
    async (req, reply) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { orgId } = req.user!;
      const updated = await locationsService.update({ id: req.params.id, orgId, ...parsed.data });
      if (!updated) return reply.code(404).send({ error: "Точка не найдена" });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: app.requireRole(["OWNER"]) },
    async (req, reply) => {
      const { orgId } = req.user!;
      const archived = await locationsService.archive(req.params.id, orgId);
      if (!archived) return reply.code(404).send({ error: "Точка не найдена" });
      return { success: true };
    }
  );

  app.get<{ Params: { id: string } }>("/:id/employees", async (req, reply) => {
    try {
      const { orgId } = req.user!;
      return await locationsService.getEmployees(req.params.id, orgId);
    } catch (e: any) {
      if (e.message === "LOCATION_NOT_FOUND") return reply.code(404).send({ error: "Точка не найдена" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });

  app.put<{ Params: { id: string } }>(
    "/:id/employees",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      const parsed = setEmployeesSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      try {
        const { orgId } = req.user!;
        return await locationsService.setEmployees(req.params.id, orgId, parsed.data.userIds);
      } catch (e: any) {
        if (e.message === "LOCATION_NOT_FOUND") return reply.code(404).send({ error: "Точка не найдена" });
        if (e.message === "INVALID_USER_IDS") return reply.code(400).send({ error: "Некорректные сотрудники" });
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка" });
      }
    }
  );
}