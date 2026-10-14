import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { usersService } from "./users.service.js";

const createSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]).optional(),
  position: z.string().max(255).optional(),
  hourlyRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  phone: z.string().max(20).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]).optional(),
  hourlyRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return usersService.list(orgId);
  });

  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { orgId } = req.user!;
      const result = await usersService.create({ ...parsed.data, orgId });
      return reply.code(201).send(result);
    } catch (e: any) {
      if (e.message === "EMAIL_TAKEN") {
        return reply.code(409).send({ error: "Email уже занят" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания сотрудника" });
    }
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { orgId } = req.user!;
    const updated = await usersService.update({
      id: req.params.id,
      orgId,
      ...parsed.data,
    });
    if (!updated) return reply.code(404).send({ error: "Сотрудник не найден" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const { orgId, sub: requesterId } = req.user!;
      const deleted = await usersService.remove(req.params.id, orgId, requesterId);
      if (!deleted) return reply.code(404).send({ error: "Сотрудник не найден" });
      return { success: true };
    } catch (e: any) {
      if (e.message === "CANNOT_DELETE_SELF") {
        return reply.code(400).send({ error: "Нельзя удалить самого себя" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка удаления" });
    }
  });
}