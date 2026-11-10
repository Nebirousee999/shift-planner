import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { analyticsService } from "./analytics.service.js";
import { overtimeService } from "./overtime.service.js";
import { buildAnalyticsExcel } from "../../lib/analytics/export-excel.js";
import { buildAnalyticsPdf } from "../../lib/analytics/export-pdf.js";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locationId: z.string().uuid().optional(),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER", "EMPLOYEE"]));

  app.get("/", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId, sub: userId, role } = req.user!;
    const targetUserId = role === "EMPLOYEE" ? userId : undefined;
    return analyticsService.summary(orgId, parsed.data.from, parsed.data.to, parsed.data.locationId, targetUserId);
  });

  app.get("/overtime", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = req.user!;
    return overtimeService.calculateForPeriod(orgId, parsed.data.from, parsed.data.to);
  });

  app.get("/export/excel", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = req.user!;
    try {
      const targetUserId = req.user!.role === "EMPLOYEE" ? req.user!.sub : undefined;
      const data = await analyticsService.summary(orgId, parsed.data.from, parsed.data.to, parsed.data.locationId, targetUserId);
      const buffer = await buildAnalyticsExcel(data);
      const filename = `Аналитика_${parsed.data.from}_${parsed.data.to}.xlsx`;
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
        .send(buffer);
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка экспорта в Excel", details: e?.message });
    }
  });

  app.get("/export/pdf", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = req.user!;
    try {
      const targetUserId = req.user!.role === "EMPLOYEE" ? req.user!.sub : undefined;
      const data = await analyticsService.summary(orgId, parsed.data.from, parsed.data.to, parsed.data.locationId, targetUserId);
      const buffer = await buildAnalyticsPdf(data);
      const filename = `Аналитика_${parsed.data.from}_${parsed.data.to}.pdf`;
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
        .send(buffer);
    } catch (e: any) {
      app.log.error({ err: e }, "PDF export failed");
      return reply.code(500).send({ error: "Ошибка экспорта в PDF", details: e?.message ?? String(e) });
    }
  });
}