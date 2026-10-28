import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { timesheetService } from "./timesheet.service.js";

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(0).max(11),
});

export async function timesheetRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  app.get("/", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = req.user!;
    return timesheetService.build(orgId, parsed.data.year, parsed.data.month);
  });
}