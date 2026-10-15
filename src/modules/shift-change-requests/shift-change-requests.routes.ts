import type { FastifyInstance } from "fastify";
import { shiftChangeRequestsService } from "./shift-change-requests.service.js";

export async function shiftChangeRequestsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // Все запросы организации — только менеджер
  app.get(
    "/",
    { preHandler: app.requireRole(["OWNER", "MANAGER"]) },
    async (req) => {
      const { orgId } = req.user!;
      return shiftChangeRequestsService.list(orgId);
    }
  );

  // Входящие — любой
  app.get("/incoming", async (req) => {
    const { sub } = req.user!;
    return shiftChangeRequestsService.incoming(sub);
  });

  app.get("/incoming/count", async (req) => {
    const { sub } = req.user!;
    return shiftChangeRequestsService.incomingCount(sub);
  });

  // Исходящие — любой
  app.get("/outgoing", async (req) => {
    const { sub } = req.user!;
    return shiftChangeRequestsService.outgoing(sub);
  });

  app.post<{ Params: { id: string } }>("/:id/approve", async (req, reply) => {
    try {
      const { sub } = req.user!;
      return await shiftChangeRequestsService.approve(req.params.id, sub);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_FOR_YOU: "Это не для вас",
        NOT_PENDING: "Уже обработан",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });

  app.post<{ Params: { id: string } }>("/:id/reject", async (req, reply) => {
    try {
      const { sub } = req.user!;
      return await shiftChangeRequestsService.reject(req.params.id, sub);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_FOR_YOU: "Это не для вас",
        NOT_PENDING: "Уже обработан",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const { sub } = req.user!;
      return await shiftChangeRequestsService.cancel(req.params.id, sub);
    } catch (e: any) {
      const map: Record<string, string> = {
        NOT_FOUND: "Запрос не найден",
        NOT_YOURS: "Это не ваш запрос",
        NOT_PENDING: "Уже обработан",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка" });
    }
  });
}