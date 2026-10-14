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
});

export async function scheduledShiftsRoutes(app: FastifyInstance) {
    app.addHook("preHandler", app.authenticate);
    app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

    // Проверка лимитов ТК РФ перед созданием/изменением смены
    app.get("/check-limits", async (req, reply) => {
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
    });

    // Проверка пересечения смен у одного сотрудника в один день
    app.get("/check-overlap", async (req, reply) => {
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
    });


    app.post("/", async (req, reply) => {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

        try {
            const { orgId } = req.user!;
            const shift = await scheduledShiftsService.create({ ...parsed.data, orgId });
            return reply.code(201).send(shift);
        } catch (e: any) {
            const map: Record<string, string> = {
                WEEK_NOT_FOUND: "������ �� �������",
                WEEK_LOCKED: "������ ��� ������������, �������������� ���������",
                DATE_OUT_OF_WEEK: "���� ����� ��� ��������� ������",
                TEMPLATE_NOT_FOUND: "������ �� ������",
                USER_NOT_FOUND: "��������� �� ������",
            };
            if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
            app.log.error(e);
            return reply.code(500).send({ error: "������ �������� �����" });
        }
    });

    app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

        try {
            const { orgId } = req.user!;
            const updated = await scheduledShiftsService.update({
                id: req.params.id,
                orgId,
                ...parsed.data,
            });
            if (!updated) return reply.code(404).send({ error: "����� �� �������" });
            return updated;
        } catch (e: any) {
            if (e.message === "WEEK_LOCKED") {
                return reply.code(400).send({ error: "������ ��� ������������" });
            }
            app.log.error(e);
            return reply.code(500).send({ error: "������ ����������" });
        }
    });

    app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
        try {
            const { orgId } = req.user!;
            const deleted = await scheduledShiftsService.remove(req.params.id, orgId);
            if (!deleted) return reply.code(404).send({ error: "����� �� �������" });
            return { success: true };
        } catch (e: any) {
            if (e.message === "WEEK_LOCKED") {
                return reply.code(400).send({ error: "������ ��� ������������" });
            }
            app.log.error(e);
            return reply.code(500).send({ error: "������ ��������" });
        }
    });
}