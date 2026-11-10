import type { FastifyInstance } from "fastify";
import { eq, isNotNull } from "drizzle-orm";
import axios from "axios";
import { db } from "../../../db/client.js";
import { payments, organizations, supportTickets } from "../../../db/schema.js";
import { yookassaService } from "../../lib/yookassa.js";
import { mailerService } from "../../lib/mailer.service.js";

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
      const senderId = sender?.user_id?.toString();
      
      const recipient = message?.recipient;
      let botId = recipient?.user_id?.toString() || body.bot_id?.toString();

      // ─── ОБРАБОТКА ОТВЕТА АДМИНА ПОДДЕРЖКИ ───
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";
      const text = message?.body?.text || "";

      if (senderId === SUPPORT_ADMIN_ID && text.startsWith("#") && SUPPORT_BOT_TOKEN) {
        const spaceIdx = text.indexOf(" ");
        const shortId = text.substring(1, spaceIdx > -1 ? spaceIdx : text.length).toUpperCase();
        const replyText = spaceIdx > -1 ? text.substring(spaceIdx + 1) : "";
        
        const tickets = await db.select().from(supportTickets);
        const ticket = tickets.find((t) => t.id.slice(0, 6).toUpperCase() === shortId);
        
        if (ticket) {
          await db
            .update(supportTickets)
            .set({ reply: replyText, status: "ANSWERED" })
            .where(eq(supportTickets.id, ticket.id));
          await mailerService.sendSupportReply(ticket.email, replyText).catch(() => {});
          
          if (ticket.userId) {
            await axios
              .post(
                `https://botapi.max.ru/messages?user_id=${ticket.userId}`,
                { text: "Ответ поддержки:\n\n" + replyText },
                { headers: { Authorization: SUPPORT_BOT_TOKEN } }
              )
              .catch(() => {});
          }
          
          await axios
            .post(
              `https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`,
              { text: "✅ Ответ на #" + shortId + " отправлен клиенту!" },
              { headers: { Authorization: SUPPORT_BOT_TOKEN } }
            )
            .catch(() => {});
        }
        return reply.send({ ok: true });
      }

      // Если событие bot_started и MAX не передал ID бота, берем его из базы
      if (updateType === "bot_started" && !botId) {
        const [org] = await db.select({ id: organizations.maxBotId }).from(organizations).where(isNotNull(organizations.maxBotId)).limit(1);
        botId = org?.id || undefined;
      }

      // Обрабатываем и нажатие кнопки "Начать", и отправку сообщений
      if ((updateType === "message_created" || updateType === "bot_started") && senderId && botId) {
        const [org] = await db
          .select({ token: organizations.maxBotToken })
          .from(organizations)
          .where(eq(organizations.maxBotId, botId));

        if (org && org.token) {
          const text = message?.body?.text || "";
          const ADMIN_ID = "141744495"; // Твой личный ID в MAX

          // Ответ на тикет: формат "#SHORTID текст"
          if (senderId === ADMIN_ID && text.startsWith("#")) {
            const spaceIdx = text.indexOf(" ");
            const shortId = text.substring(1, spaceIdx > -1 ? spaceIdx : text.length).toUpperCase();
            const replyText = spaceIdx > -1 ? text.substring(spaceIdx + 1) : "";
            const tickets = await db.select().from(supportTickets);
            const ticket = tickets.find((t) => t.id.slice(0, 6).toUpperCase() === shortId);
            if (ticket) {
              await db
                .update(supportTickets)
                .set({ reply: replyText, status: "ANSWERED" })
                .where(eq(supportTickets.id, ticket.id));
              await mailerService.sendSupportReply(ticket.email, replyText).catch(() => {});
              if (ticket.userId) {
                await axios
                  .post(
                    "https://botapi.max.ru/messages?user_id=" + ticket.userId,
                    { text: "Ответ поддержки:\n\n" + replyText },
                    { headers: { Authorization: org.token } }
                  )
                  .catch(() => {});
              }
              await axios
                .post(
                  "https://botapi.max.ru/messages?user_id=" + ADMIN_ID,
                  { text: "✅ Ответ на #" + shortId + " отправлен клиенту!" },
                  { headers: { Authorization: org.token } }
                )
                .catch(() => {});
            }
            return reply.send({ ok: true });
          }

          // Если пишет сам админ, бот просто сохраняет ID (для привязки)
          if (senderId === ADMIN_ID) {
            const replyText = `Привет! Твой ID в MAX:\n\n${senderId}\n\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.`;
            await axios.post(`https://botapi.max.ru/messages?user_id=${senderId}`, { text: replyText }, { headers: { Authorization: org.token } });
          } 
          // Если пишет клиент — пересылаем тебе в ЛС
          else {
            // 1. Отвечаем клиенту
            await axios.post(
              `https://botapi.max.ru/messages?user_id=${senderId}`,
              { text: `Спасибо! Ваше сообщение передано в поддержку. Мы ответим вам в ближайшее время.` },
              { headers: { Authorization: org.token } }
            );

            // 2. Пересылаем сообщение Админу
            const forwardText = `📩 Новое сообщение в поддержку!\n\nОт: ${sender?.name || 'Пользователь'} (ID: ${senderId})\nТекст: ${text}`;
            await axios.post(
              `https://botapi.max.ru/messages?user_id=${ADMIN_ID}`,
              { text: forwardText },
              { headers: { Authorization: org.token } }
            );
            app.log.info({ senderId }, "✅ Сообщение клиента переслано админу");
          }
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
