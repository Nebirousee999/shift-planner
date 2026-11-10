import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets } from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import axios from "axios";

export async function supportRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = (req as any).user?.sub || null;
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId,
        email: parsed.data.email,
        message: parsed.data.message,
        images: parsed.data.images,
      })
      .returning();
    const shortId = ticket.id.slice(0, 6).toUpperCase();

    await mailerService
      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId, parsed.data.images)
      .catch((e) => app.log.error(e));

    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (SUPPORT_BOT_TOKEN) {
        await axios.post(
          `https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`,
          {
            text:
              "📩 Обращение #" + shortId + "\n" +
              "От: " + parsed.data.email + "\n\n" +
              parsed.data.message + "\n\n" +
              "Чтобы ответить, напишите:\n#" + shortId + " ваш ответ",
          },
          { headers: { Authorization: SUPPORT_BOT_TOKEN } }
        );

        if (parsed.data.images.length > 0) {
          await axios.post(
            `https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`,
            { text: "📎 Клиент прикрепил " + parsed.data.images.length + " фото. Они отправлены вам на почту." },
            { headers: { Authorization: SUPPORT_BOT_TOKEN } }
          );
        }
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX support send failed");
    }

    return { success: true, ticketId: shortId };
  });

  app.get("/my", async (req) => {
    const userId = (req as any).user?.sub;
    if (!userId) return [];
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  });
}
