import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meService } from "./me.service.js";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8, "Минимум 8 символов"),
});

const myShiftsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function meRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req, reply) => {
    const { sub: userId, orgId } = req.user!;
    const profile = await meService.profile(userId, orgId);
    if (!profile) return reply.code(404).send({ error: "Профиль не найден" });
    return profile;
  });

  app.post("/change-password", async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { sub: userId } = req.user!;
      await meService.changePassword(
        userId,
        parsed.data.oldPassword,
        parsed.data.newPassword,
      );
      return { success: true };
    } catch (e: any) {
      if (e.message === "WRONG_PASSWORD") {
        return reply.code(400).send({ error: "Неверный текущий пароль" });
      }
      if (e.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "Пользователь не найден" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка смены пароля" });
    }
  });

  app.get("/shifts", async (req, reply) => {
    const parsed = myShiftsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const { sub: userId, orgId } = req.user!;
      return await meService.myShifts(userId, orgId, parsed.data);
    } catch (e: any) {
      if (e.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "Пользователь не найден" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка загрузки смен" });
    }
  });
  // Коллеги — доступно всем ролям
  app.get("/colleagues", async (req) => {
    const { orgId } = req.user!;
    return meService.colleagues(orgId);
  });

}