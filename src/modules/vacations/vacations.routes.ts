import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { vacationsService } from "./vacations.service.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  userId: z.string().uuid().optional(),
  startDate: z.string().regex(dateRegex),
  endDate: z.string().regex(dateRegex),
  comment: z.string().max(255).optional(),
});

const updateSchema = z.object({
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  comment: z.string().max(255).nullable().optional(),
});

const checkSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(dateRegex),
});

export async function vacationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ─── Список всех отпусков ──────────────────────────
  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return vacationsService.list(orgId);
  });

  // ─── Мои отпуска ───────────────────────────────────
  app.get("/mine", async (req) => {
    const { sub: userId } = req.user!;
    return vacationsService.mine(userId);
  });

  // ─── Pending: только для менеджера ─────────────────
  app.get(
    "/pending",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req) => {
      const { orgId } = req.user!;
      return vacationsService.listPending(orgId);
    }
  );

  app.get(
    "/pending/count",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req) => {
      const { orgId } = req.user!;
      return vacationsService.pendingCount(orgId);
    }
  );

  // ─── Проверка попадания в отпуск ───────────────────
  app.get("/check", async (req, reply) => {
    const parsed = checkSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    const found = await vacationsService.check(
      parsed.data.userId,
      parsed.data.date,
      orgId
    );
    return { onVacation: !!found, vacation: found };
  });

  // ─── Создать отпуск ────────────────────────────────
  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { sub: userId, orgId, role } = req.user!;
      const targetUserId =
        role === "OWNER" || role === "MANAGER"
          ? parsed.data.userId ?? userId
          : userId;

      const vac = await vacationsService.create({
        orgId,
        userId: targetUserId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        comment: parsed.data.comment,
        requesterRole: role,
      });
      return reply.code(201).send(vac);
    } catch (e: any) {
      if (e.message === "INVALID_DATES") {
        return reply
          .code(400)
          .send({ error: "Дата начала позже даты окончания" });
      }
      if (e.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "Сотрудник не найден" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания" });
    }
  });

  // ─── Обновить отпуск ───────────────────────────────
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { sub: userId, orgId, role } = req.user!;
      const updated = await vacationsService.update({
        id: req.params.id,
        orgId,
        requesterId: userId,
        requesterRole: role,
        ...parsed.data,
      });
      return updated;
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Отпуск не найден",
        FORBIDDEN: "Можно менять только свой отпуск",
        INVALID_DATES: "Дата начала позже даты окончания",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка обновления" });
    }
  });

  // ─── Модерация ─────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/:id/approve",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      try {
        const { sub: userId, orgId } = req.user!;
        return await vacationsService.approve(req.params.id, orgId, userId);
      } catch (e: any) {
        const map: Record<string, string> = {
          NOT_FOUND: "Отпуск не найден",
          NOT_PENDING: "Отпуск не в статусе ожидания",
        };
        if (map[e.message])
          return reply.code(400).send({ error: map[e.message] });
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка одобрения" });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    "/:id/reject",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      try {
        const { sub: userId, orgId } = req.user!;
        return await vacationsService.reject(req.params.id, orgId, userId);
      } catch (e: any) {
        const map: Record<string, string> = {
          NOT_FOUND: "Отпуск не найден",
          NOT_PENDING: "Отпуск не в статусе ожидания",
        };
        if (map[e.message])
          return reply.code(400).send({ error: map[e.message] });
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка отклонения" });
      }
    }
  );

  // ─── Удалить ───────────────────────────────────────
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const { sub: userId, orgId, role } = req.user!;
      return await vacationsService.remove({
        id: req.params.id,
        orgId,
        requesterId: userId,
        requesterRole: role,
      });
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Отпуск не найден",
        FORBIDDEN: "Можно удалять только свой отпуск",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка удаления" });
    }
  });
}