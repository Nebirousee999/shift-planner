import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { organizationService } from "./organization.service.js";

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  city: z.string().max(100).nullable().optional(),
  directorName: z.string().max(255).nullable().optional(),
  inn: z.string().max(20).nullable().optional(),
  legalAddress: z.string().max(500).nullable().optional(),
  timeTrackingEnabled: z.boolean().optional(),
  overtimeMultiplier1: z.string().optional(),
  overtimeMultiplier2: z.string().optional(),
  maxLocations: z.number().int().min(1).max(1000).optional(),
  positionHeaderOpacity: z.number().int().min(0).max(100).optional(),
  positionRowOpacity: z.number().int().min(0).max(100).optional(),
  taxRate: z.string().optional(),
  requireShiftApproval: z.boolean().optional(),
  disciplineEditWindowDays: z.number().int().min(0).max(90).optional(),
  maxBotLink: z.string().max(255).nullable().optional(),
  maxBotToken: z.string().max(255).nullable().optional(),
});

export async function organizationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/broadcast-bot-link", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {
    try {
      const { orgId } = req.user!;
      const result = await organizationService.broadcastBotLink(orgId);
      return result;
    } catch (e: any) {
      app.log.error(e);
      return reply.code(400).send({ error: e.message || "Ошибка рассылки" });
    }
  });

  app.get("/export-json", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {
    const { orgId } = req.user!;
    try {
      const data = await organizationService.exportJson(orgId);
      reply
        .header("Content-Type", "application/json")
        .header("Content-Disposition", `attachment; filename="backup_${Date.now()}.json"`)
        .send(data);
    } catch (e: any) {
      return reply.code(403).send({ error: "Выгрузка доступна только на тарифе Business" });
    }
  });

  app.get("/", async (req, reply) => {
    const { orgId } = req.user!;
    const org = await organizationService.get(orgId);
    if (!org) return reply.code(404).send({ error: "Организация не найдена" });
    return org;
  });

  app.patch(
    "/",
    { preHandler: app.requireRole(["OWNER"]) },
    async (req, reply) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { orgId } = req.user!;
      try {
        const updated = await organizationService.update({ orgId, ...parsed.data });
        return updated;
      } catch (e: any) {
        if (e.message === "MAX_LOCATIONS_TOO_LOW") {
          return reply.code(400).send({
            error: "Нельзя установить лимит меньше текущего числа точек",
          });
        }
        throw e;
      }
    }
  );
}