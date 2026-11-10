import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages } from "../../../db/schema.js";
import axios from "axios";
import crypto from "node:crypto";

export async function supportRoutes(app: FastifyInstance) {
  // 🔥 Мягкая проверка токена: если он есть — авторизуем, если нет — пропускаем как гостя
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch (e) {
      // Игнорируем ошибку (гость)
    }
  });

  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
      sessionToken: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // req.user будет существовать, если токен валиден
    const userId = (req as any).user?.sub || null;
    let sessionToken = parsed.data.sessionToken || crypto.randomUUID();

    let ticket;

    if (userId) {
      // 🔥 Авторизован: ищем по профилю
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      
      if (found.length > 0) {
        ticket = found[0];
        if (ticket.sessionToken !== sessionToken) {
          await db.update(supportTickets)
            .set({ sessionToken })
            .where(eq(supportTickets.id, ticket.id));
        }
      }
    } else {
      // 🔥 Гость: ищем по кукам
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
      
      if (found.length > 0) {
        if (found[0].email === parsed.data.email) {
          ticket = found[0];
        } else {
          sessionToken = crypto.randomUUID(); // Сменили почту — новый гость
        }
      }
    }

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

    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (SUPPORT_BOT_TOKEN) {
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
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken: ticket.sessionToken };
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
    } else if (sessionToken) {
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
