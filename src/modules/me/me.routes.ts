import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { userMessengers } from "../../../db/schema.js";
import { meService } from "./me.service.js";
import { messengerService } from "../../lib/messenger.service.js"; // <--- ДОБАВЛЕН ИМПОРТ

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8, "Минимум 8 символов"),
});

const myShiftsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Схема для привязки мессенджера
const bindMessengerSchema = z.object({
  provider: z.enum(["telegram", "max"]),
  externalId: z.string().min(1),
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

  app.get("/colleagues", async (req) => {
    const { orgId } = req.user!;
    return meService.colleagues(orgId);
  });

  // ─── ПРИВЯЗКА МЕССЕНДЖЕРОВ ───────────────────────
  app.post("/messengers/bind", async (req, reply) => {
    const parsed = bindMessengerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { sub: userId } = req.user!;
    const { provider, externalId } = parsed.data;

    try {
      // Проверяем, не привязан ли этот аккаунт к другому пользователю
      const existing = await db
        .select()
        .from(userMessengers)
        .where(
          and(
            eq(userMessengers.provider, provider),
            eq(userMessengers.externalId, externalId)
          )
        );

      if (existing.length > 0 && existing[0].userId !== userId) {
        return reply
          .code(400)
          .send({ error: "Этот аккаунт уже привязан к другому пользователю" });
      }

      // Удаляем старую привязку этого провайдера у пользователя (если была)
      await db
        .delete(userMessengers)
        .where(
          and(
            eq(userMessengers.userId, userId),
            eq(userMessengers.provider, provider)
          )
        );

      // Создаем новую привязку
      await db.insert(userMessengers).values({ userId, provider, externalId });

      return { success: true };
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка привязки мессенджера" });
    }
  });

  // ─── ТЕСТ ОТПРАВКИ УВЕДОМЛЕНИЯ ───────────────────
  app.get("/test-messenger", async (req, reply) => {
    const { sub: userId } = req.user!;
    
    console.log(`\n🧪 [Test] Запуск теста отправки для userId: ${userId}`);
    
    const success = await messengerService.sendToUser(
      userId,
      `<b>Тест связи!</b>\n\nЭто сообщение отправлено из твоего планировщика. Если ты его видишь — значит интеграция с MAX работает идеально.`
    );

    return { success };
  });
}