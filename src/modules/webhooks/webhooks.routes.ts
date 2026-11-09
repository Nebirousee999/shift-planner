import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import axios from "axios";
import { db } from "../../../db/client.js";
import { payments, organizations } from "../../../db/schema.js";
import { yookassaService } from "../../lib/yookassa.js";

export async function webhooksRoutes(app: FastifyInstance) {
  app.post("/yookassa", async (req, reply) => {
    const event = req.body as {
      event: string;
      object: {
        id: string;
        status: string;
        metadata?: Record<string, string>;
      };
    };

    app.log.info(
      { event: event.event, paymentId: event.object.id },
      "YooKassa Webhook"
    );

    try {
      if (event.event === "payment.succeeded") {
        try {
          const realPayment = await yookassaService.getPayment(event.object.id);
          if (!realPayment || realPayment.status !== "succeeded" || !realPayment.paid) {
            app.log.warn({ paymentId: event.object.id }, "Подделка вебхука или платеж не оплачен");
            return reply.code(400).send({ error: "Payment not verified" });
          }
        } catch (err) {
          app.log.error(err, "Ошибка проверки платежа через API ЮKassa");
          return reply.code(500).send({ error: "Verification failed" });
        }

        await db
          .update(payments)
          .set({ status: "succeeded", updatedAt: new Date() })
          .where(eq(payments.yookassaId, event.object.id));

        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.yookassaId, event.object.id));

        if (payment && payment.metadata) {
          const meta = payment.metadata as { orgId: string; tariffId: string };
          
          if (meta.orgId) {
           const days = Number(meta.periodDays) || 30;
           const expiresAt = new Date();
           expiresAt.setDate(expiresAt.getDate() + days);

           await db
            .update(organizations)
            .set({ 
              maxLocations: meta.tariffId === "business" ? 5 : 1,
              tariffId: meta.tariffId,
              tariffExpiresAt: expiresAt,
              trialEndsAt: null
            })
            .where(eq(organizations.id, meta.orgId));
          }
        }
      } 
      else if (event.event === "payment.canceled") {
        await db
          .update(payments)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(payments.yookassaId, event.object.id));
      }

      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Internal Error" });
    }
  });

  // ─── MAX Bot Webhook ──────────────────────────────
  app.post("/max", async (req, reply) => {
    try {
      const body = req.body as any;
      const updateType = body.update_type;
      const message = body.message;
      const sender = message?.sender || body.user;
      const recipient = message?.recipient;

      const senderId = sender?.user_id?.toString();
      // В message_created получатель (recipient) — это бот
      const botId = recipient?.user_id?.toString() || body.bot_id?.toString();

      if (updateType === "message_created" && senderId && botId) {
        const [org] = await db
          .select({ token: organizations.maxBotToken })
          .from(organizations)
          .where(eq(organizations.maxBotId, botId));

        if (org && org.token) {
          const replyText = `Привет! Твой ID в MAX: <b>${senderId}</b>\n\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.`;
          await axios.post(
            `https://botapi.max.ru/messages?user_id=${senderId}`,
            { text: replyText },
            { headers: { Authorization: org.token } }
          );
          app.log.info({ botId, senderId }, "✅ Отправлено приветственное сообщение в MAX");
        } else {
          app.log.warn({ botId }, "❌ Бот не найден в БД или отсутствует токен");
        }
      }
      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Internal Error" });
    }
  });
}
