import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { scheduledShiftsService } from "./scheduled-shifts.service.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z.object({
  weekId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  shiftDate: z.string().regex(dateRegex),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
});

const checkLimitsSchema = z.object({
  userId: z.string().uuid(),
  weekId: z.string().uuid(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  excludeShiftId: z.string().uuid().optional(),
});

const checkOverlapSchema = z.object({
  userId: z.string().uuid(),
  weekId: z.string().uuid(),
  shiftDate: z.string().regex(dateRegex),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  excludeShiftId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  shiftDate: z.string().regex(dateRegex).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  latenessMinutes: z.number().int().min(0).optional(),     // <--- ДОБАВИТЬ ЭТУ СТРОКУ
  earlyLeaveMinutes: z.number().int().min(0).optional(),   // <--- ДОБАВИТЬ ЭТУ СТРОКУ
  overtimeMinutes: z.number().int().min(0).optional(),
  isNoShow: z.boolean().optional(),
  isUnknownAbsence: z.boolean().optional(),
});

export async function scheduledShiftsRoutes(app: FastifyInstance) {
  // Все роуты требуют авторизации
  app.addHook("preHandler", app.authenticate);

  // ─── Проверка лимитов ТК РФ — только админ ─────────────
  app.get(
    "/check-limits",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      const parsed = checkLimitsSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        const { orgId } = req.user!;
        return await scheduledShiftsService.checkLimits({
          ...parsed.data,
          orgId,
        });
      } catch (e: any) {
        const map: Record<string, string> = {
          WEEK_NOT_FOUND: "Неделя не найдена",
          USER_NOT_FOUND: "Сотрудник не найден",
        };
        if (map[e.message]) {
          return reply.code(400).send({ error: map[e.message] });
        }
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка проверки" });
      }
    }
  );

  // ─── Проверка пересечения — только админ ───────────────
  app.get(
    "/check-overlap",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      const parsed = checkOverlapSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      try {
        const { orgId } = req.user!;
        return await scheduledShiftsService.checkOverlap({
          ...parsed.data,
          orgId,
        });
      } catch (e: any) {
        const map: Record<string, string> = {
          WEEK_NOT_FOUND: "Неделя не найдена",
          USER_NOT_FOUND: "Сотрудник не найден",
        };
        if (map[e.message]) {
          return reply.code(400).send({ error: map[e.message] });
        }
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка проверки" });
      }
    }
  );

  // ─── Создать смену — только админ ──────────────────────
  app.post(
    "/",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      try {
        const { orgId, sub: requesterId, role: requesterRole } = req.user!;
        const result = await scheduledShiftsService.create({
          ...parsed.data,
          orgId,
          requesterId,
          requesterRole,
        });
        return reply.code(201).send(result);
      } catch (e: any) {
        const map: Record<string, string> = {
          WEEK_NOT_FOUND: "Неделя не найдена",
          WEEK_LOCKED: "Неделя заблокирована, редактирование невозможно",
          DATE_OUT_OF_WEEK: "Дата вне диапазона недели",
          TEMPLATE_NOT_FOUND: "Шаблон не найден",
          USER_NOT_FOUND: "Сотрудник не найден",
        };
        if (map[e.message]) {
          return reply.code(400).send({ error: map[e.message] });
        }
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка создания смены" });
      }
    }
  );

  // ─── Обновить смену — ЛЮБОЙ авторизованный ─────────────
  // Если неделя DRAFT: применяется сразу.
  // Если PUBLISHED: создаётся запрос на согласование.
  //   - сотрудник меняет → согласовывает менеджер
  //   - менеджер меняет  → согласовывает сотрудник (чью смену меняют)
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { orgId, sub: requesterId, role: requesterRole } = req.user!;
      const result = await scheduledShiftsService.update({
        id: req.params.id,
        orgId,
        requesterId,
        requesterRole,
        ...parsed.data,
      });
      // result = { kind: "applied" | "requested", ... }
      return result;
    } catch (e: any) {
      const map: Record<string, string> = {
        SHIFT_NOT_FOUND: "Смена не найдена",
        WEEK_LOCKED: "Неделя заблокирована",
        DISCIPLINE_WINDOW_CLOSED: "Прошло слишком много времени. Редактирование дисциплины за этот день закрыто.",
        FORBIDDEN: "Недостаточно прав для изменения дисциплины",
      };
      if (map[e.message]) {
        return reply.code(e.message === "SHIFT_NOT_FOUND" ? 404 : 400).send({
          error: map[e.message],
        });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка обновления" });
    }
  });

  // ─── Удалить смену — только админ ──────────────────────
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req, reply) => {
      try {
        const { orgId } = req.user!;
        const deleted = await scheduledShiftsService.remove(
          req.params.id,
          orgId
        );
        if (!deleted) {
          return reply.code(404).send({ error: "Смена не найдена" });
        }
        return { success: true };
      } catch (e: any) {
        if (e.message === "WEEK_LOCKED") {
          return reply.code(400).send({ error: "Неделя заблокирована" });
        }
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка удаления" });
      }
    }
  );
}