import type { FastifyInstance } from "fastify";
import { notificationsService } from "./notifications.service.js";

export async function notificationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const { sub: userId } = req.user!;
    return notificationsService.list(userId);
  });

  app.get("/unread/count", async (req) => {
    const { sub: userId } = req.user!;
    return notificationsService.unreadCount(userId);
  });

  app.post<{ Params: { id: string } }>("/:id/ack", async (req) => {
    const { sub: userId } = req.user!;
    return notificationsService.acknowledge(req.params.id, userId);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const { sub: userId } = req.user!;
    return notificationsService.dismiss(req.params.id, userId);
  });

  app.post("/ack-all", async (req) => {
    const { sub: userId } = req.user!;
    return notificationsService.acknowledgeAll(userId);
  });
}
