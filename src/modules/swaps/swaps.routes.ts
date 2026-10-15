import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { swapsService } from "./swaps.service.js";

const createSchema = z.object({
  shiftId: z.string().uuid(),
  swapWithUserId: z.string().uuid().optional(),
});

export async function swapsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Все запросы организации — только админ
  app.get(
    "/",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req) => {
      const { orgId } = req.user!;
      return swapsService.list(orgId);
    }
  );

  // Мои исходящие — любой
  app.get("/outgoing", async (req) => {
    const { sub: userId } = req.user!;
    return swapsService.outgoing(userId);
  });

  // Входящие — любой
  app.get("/incoming", async (req) => {
    const { sub: userId } = req.user!;
    return swapsService.incoming(userId);
  });

  // ─── Счётчик входящих pending-предложений ───────────
  app.get("/incoming/count", async (req) => {
    const { sub: userId } = req.user!;
    const all = await swapsService.incoming(userId);
    return { count: all.length };
  });

  // Создать запрос — любой
  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { sub: userId, orgId } = req.user!;
      const request = await swapsService.create({
        orgId,
        requestedBy: userId,
        shiftId: parsed.data.shiftId,
        swapWithUserId: parsed.data.swapWithUserId,
      });
      return reply.code(201).send(request);
    } catch (e: any) {
      const map: Record<string, string> = {
        SHIFT_NOT_FOUND: "Смена не найдена",
        NOT_YOUR_SHIFT: "Это не ваша смена",
        USER_NOT_FOUND: "Сотрудник не найден",
        SELF_SWAP: "Нельзя предложить смену самому себе",
        TARGET_BUSY: "У выбранного сотрудника уже есть смена в это время — обмен невозможен",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания запроса" });
    }
  });

  // Принять — любой
  app.post<{ Params: { id: string } }>("/:id/accept", async (req, reply) => {
    try {
      const { sub: userId } = req.user!;
      return await swapsService.accept(req.params.id, userId);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_PENDING: "Запрос уже обработан",
        NOT_FOR_YOU: "Это предложение не для вас",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });

  // Отклонить — любой
  app.post<{ Params: { id: string } }>("/:id/decline", async (req, reply) => {
    try {
      const { sub: userId } = req.user!;
      return await swapsService.decline(req.params.id, userId);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_PENDING: "Запрос уже обработан",
        NOT_FOR_YOU: "Это предложение не для вас",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });

  // Отменить — любой (только свой)
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const { sub: userId } = req.user!;
      return await swapsService.cancel(req.params.id, userId);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_YOURS: "Это не ваш запрос",
        NOT_PENDING: "Запрос уже обработан",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });
}