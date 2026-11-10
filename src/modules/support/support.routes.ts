import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages } from "../../../db/schema.js";
import axios from "axios";
import crypto from "node:crypto";

export async function supportRoutes(app: FastifyInstance) {
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

    let ticket;

    // 1. Если авторизован — ищем по userId
    if (userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      
      if (found.length > 0) {
        ticket = found[0];
        // Обновляем сессию, если зашли с нового устройства
        if (ticket.sessionToken !== sessionToken) {
          await db.update(supportTickets)
            .set({ sessionToken })
            .where(eq(supportTickets.id, ticket.id));
        }
      }
    }

    // 2. Если не нашли (или гость) — ищем по сессии
    if (!ticket && !userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) ticket = found[0];
    }

    // 3. Если тикета нет — создаем новый
    if (!ticket) {
      const inserted = await db
        .insert(supportTickets)
        .values({
          userId,
          email: parsed.data.email,
          sessionToken,
          status: "OPEN",
          message: parsed.data.message,
        })
        .returning();
      ticket = inserted[0];
    }

    // Сохраняем сообщение в историю
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    // Отправляем уведомление в MAX (только через бота поддержки)
    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (!SUPPORT_BOT_TOKEN) {
        app.log.error("❌ ОШИБКА: SUPPORT_BOT_TOKEN не задан в .env!");
        return reply.code(500).send({ error: "Support bot token missing" });
      }

      await axios.post(
        `https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`,
        {
          text: "📩 Чат поддержки #" + shortId + "\n" +
                (userId ? "Пользователь: " + parsed.data.email : "Гость: " + parsed.data.email) + "\n\n" +
                parsed.data.message + "\n\n" +
                "Чтобы ответить, напишите:\n#" + shortId + " ваш ответ",
        },
        { headers: { Authorization: SUPPORT_BOT_TOKEN } }
      );
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken };
  });

  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    const userId = (req as any).user?.sub || null;

    let ticket;

    if (userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      if (found.length > 0) ticket = found[0];
    }

    if (!ticket && sessionToken && !userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) ticket = found[0];
    }

    if (!ticket) return [];

    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticket.id))
      .orderBy(supportMessages.createdAt);
  });
}
