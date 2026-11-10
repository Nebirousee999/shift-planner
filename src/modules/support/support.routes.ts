import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages } from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import axios from "axios";
import crypto from "node:crypto";

export async function supportRoutes(app: FastifyInstance) {
  // Отправка нового сообщения (создает тикет, если его нет)
  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
      sessionToken: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const userId = (req as any).user?.sub || null;
    let { sessionToken } = parsed.data;
    if (!sessionToken) sessionToken = crypto.randomUUID();

    // Ищем существующий тикет по сессии
    let [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.sessionToken, sessionToken));

    if (!ticket) {
      [ticket] = await db
        .insert(supportTickets)
        .values({
          userId,
          email: parsed.data.email,
          sessionToken,
          status: "OPEN",
          message: parsed.data.message, // Передаем первое сообщение в старое поле для совместимости
        })
        .returning();
    }

    // Сохраняем сообщение
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    // Уведомляем админа на почту
    await mailerService
      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId, parsed.data.images)
      .catch((e) => app.log.error(e));

    // Уведомляем админа в MAX
    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";
      if (SUPPORT_BOT_TOKEN) {
        await axios.post(
          `https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`,
          {
            text: "📩 Чат поддержки #" + shortId + "\nОт: " + parsed.data.email + "\n\n" + parsed.data.message + "\n\nЧтобы ответить, напишите:\n#" + shortId + " ваш ответ",
          },
          { headers: { Authorization: SUPPORT_BOT_TOKEN } }
        );
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken };
  });

  // Получение истории сообщений
  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    if (!sessionToken) return [];

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.sessionToken, sessionToken));

    if (!ticket) return [];

    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticket.id))
      .orderBy(supportMessages.createdAt);
  });
}
