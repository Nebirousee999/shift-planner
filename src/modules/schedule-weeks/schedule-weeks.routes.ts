import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scheduleWeeksService } from "./schedule-weeks.service.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  weekStartDate: z.string().regex(dateRegex, "Формат: YYYY-MM-DD"),
});

export async function scheduleWeeksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return scheduleWeeksService.list(orgId);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { orgId } = req.user!;
    const week = await scheduleWeeksService.get(req.params.id, orgId);
    if (!week) return reply.code(404).send({ error: "Неделя не найдена" });
    return week;
  });

  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { orgId } = req.user!;
      const week = await scheduleWeeksService.create({ ...parsed.data, orgId });
      return reply.code(201).send(week);
    } catch (e: any) {
      if (e.message === "WEEK_EXISTS") {
        return reply.code(409).send({ error: "Неделя уже создана" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания недели" });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/publish", async (req, reply) => {
    try {
      const { orgId } = req.user!;
      const result = await scheduleWeeksService.publish(req.params.id, orgId);

      if (!result.ok) {
        return reply.code(422).send({
          error: "Нарушения ТК РФ",
          violations: result.violations,
        });
      }
      return result.week;
    } catch (e: any) {
      if (e.message === "WEEK_NOT_FOUND") {
        return reply.code(404).send({ error: "Неделя не найдена" });
      }
      if (e.message === "ALREADY_PUBLISHED") {
        return reply.code(409).send({ error: "Неделя уже опубликована" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка публикации" });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    try {
      const { orgId } = req.user!;
      const newWeek = await scheduleWeeksService.duplicate(req.params.id, orgId);
      return reply.code(201).send(newWeek);
    } catch (e: any) {
      if (e.message === "WEEK_NOT_FOUND") {
        return reply.code(404).send({ error: "Неделя не найдена" });
      }
      if (e.message === "WEEK_EXISTS") {
        return reply
          .code(409)
          .send({ error: "Следующая неделя уже существует" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка копирования" });
    }
  });
}