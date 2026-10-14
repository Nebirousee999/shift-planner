import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { timeEntriesService } from "./time-entries.service.js";

const listQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const clockInSchema = z.object({
  userId: z.string().uuid().optional(), // если не указан — берём из токена
  shiftId: z.string().uuid().optional(),
});

export async function timeEntriesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    return timeEntriesService.list(orgId, parsed.data);
  });

  app.get("/active", async (req) => {
    const { sub: userId, orgId } = req.user!;
    return timeEntriesService.getActive(userId, orgId);
  });

  app.post("/clock-in", async (req, reply) => {
    const parsed = clockInSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { sub: currentUserId, orgId } = req.user!;
      const targetUserId = parsed.data.userId ?? currentUserId;

      const entry = await timeEntriesService.clockIn({
        userId: targetUserId,
        orgId,
        shiftId: parsed.data.shiftId,
      });
      return reply.code(201).send(entry);
    } catch (e: any) {
      const map: Record<string, string> = {
        USER_NOT_FOUND: "Сотрудник не найден",
        ALREADY_OPEN: "У вас уже открыта смена",
        SHIFT_NOT_FOUND: "Смена не найдена",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка отметки" });
    }
  });

  app.post("/clock-out", async (req, reply) => {
    try {
      const { sub: currentUserId, orgId } = req.user!;
      const entry = await timeEntriesService.clockOut(currentUserId, orgId);
      return entry;
    } catch (e: any) {
      const map: Record<string, string> = {
        USER_NOT_FOUND: "Сотрудник не найден",
        NO_OPEN_ENTRY: "Нет открытой смены для завершения",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка отметки" });
    }
  });
}