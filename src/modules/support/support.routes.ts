import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, organizations } from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import axios from "axios";

export async function supportRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
    }).safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = (req as any).user?.sub || null;
    const [ticket] = await db
      .insert(supportTickets)
      .values({ userId, email: parsed.data.email, message: parsed.data.message })
      .returning();
    const shortId = ticket.id.slice(0, 6).toUpperCase();

    await mailerService
      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId)
      .catch((e) => app.log.error(e));

    try {
      const [org] = await db.select().from(organizations).limit(1);
      if (org?.maxBotToken) {
        await axios.post(
          "https://botapi.max.ru/messages?user_id=141744495",
          {
            text:
              "📩 Обращение #" + shortId + "\n" +
              "От: " + parsed.data.email + "\n\n" +
              parsed.data.message + "\n\n" +
              "Чтобы ответить, напишите:\n#" + shortId + " ваш ответ",
          },
          { headers: { Authorization: org.maxBotToken } }
        );
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
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
