import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { shiftTemplatesService } from "./shift-templates.service.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z.object({
    name: z.string().min(2).max(100),
    startTime: z.string().regex(timeRegex, "Формат: HH:MM"),
    endTime: z.string().regex(timeRegex, "Формат: HH:MM"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateSchema = createSchema.partial();

export async function shiftTemplatesRoutes(app: FastifyInstance) {
    // Только авторизация, без проверки роли
    app.addHook("preHandler", app.authenticate);

    // Читать могут все
    app.get("/", async (req) => {
        const { orgId } = req.user!;
        return shiftTemplatesService.list(orgId);
    });

    // Создавать/менять/удалять — только OWNER и MANAGER
    app.post(
        "/",
        { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
        async (req, reply) => {
            const parsed = createSchema.safeParse(req.body);
            if (!parsed.success) {
                return reply.code(400).send({ error: parsed.error.flatten() });
            }
            const { orgId } = req.user!;
            const template = await shiftTemplatesService.create({ ...parsed.data, orgId });
            return reply.code(201).send(template);
        }
    );

    app.patch<{ Params: { id: string } }>(
        "/:id",
        { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
        async (req, reply) => {
            const parsed = updateSchema.safeParse(req.body);
            if (!parsed.success) {
                return reply.code(400).send({ error: parsed.error.flatten() });
            }
            const { orgId } = req.user!;
            const updated = await shiftTemplatesService.update({
                id: req.params.id,
                orgId,
                ...parsed.data,
            });
            if (!updated) return reply.code(404).send({ error: "Шаблон не найден" });
            return updated;
        }
    );

    app.delete<{ Params: { id: string } }>(
        "/:id",
        { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
        async (req, reply) => {
            const { orgId } = req.user!;
            const deleted = await shiftTemplatesService.remove(req.params.id, orgId);
            if (!deleted) return reply.code(404).send({ error: "Шаблон не найден" });
            return { success: true };
        }
    );
}