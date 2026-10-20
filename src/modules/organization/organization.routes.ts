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
});

export async function organizationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Читать может любой сотрудник организации
  app.get("/", async (req, reply) => {
    const { orgId } = req.user!;
    const org = await organizationService.get(orgId);
    if (!org) return reply.code(404).send({ error: "Организация не найдена" });
    return org;
  });

  // Обновлять — только владелец
  app.patch(
    "/",
    { preHandler: app.requireRole(["OWNER"]) },
    async (req, reply) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { orgId } = req.user!;
      const updated = await organizationService.update({
        orgId,
        ...parsed.data,
      });
      return updated;
    }
  );
}