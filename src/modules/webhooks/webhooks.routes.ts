import type { FastifyInstance } from "fastify";
import { eq, isNotNull, and } from "drizzle-orm";
import axios from "axios";
import { db } from "../../../db/client.js";
import { payments, organizations, supportTickets, supportMessages, userMessengers } from "../../../db/schema.js";
import { yookassaService } from "../../lib/yookassa.js";

export async function webhooksRoutes(app: FastifyInstance) {
  app.post("/yookassa", async (req, reply) => {
    // ... (оставляем без изменений, код ЮKassa)
    const event = req.body as any;
    try {
      if (event.event === "payment.succeeded") {
        const realPayment = await yookassaService.getPayment(event.object.id);
        if (!realPayment || realPayment.status !== "succeeded" || !realPayment.paid) return reply.code(400).send({ error: "Payment not verified" });
        await db.update(payments).set({ status: "succeeded", updatedAt: new Date() }).where(eq(payments.yookassaId, event.object.id));
        const [payment] = await db.select().from(payments).where(eq(payments.yookassaId, event.object.id));
                if (payment && payment.metadata) {
          const meta = payment.metadata as any;
          if (meta.orgId) {
            const days = Number(meta.periodDays) || 30;

            // 🔥 Получаем текущую организацию, чтобы проверить, активна ли подписка
            const [org] = await db.select().from(organizations).where(eq(organizations.id, meta.orgId));

            let baseDate = new Date();
            // Если подписка еще не истекла — прибавляем дни к дате ее окончания
            if (org && org.tariffExpiresAt && new Date(org.tariffExpiresAt) > baseDate) {
              baseDate = new Date(org.tariffExpiresAt);
            }

            const expiresAt = new Date(baseDate);
            expiresAt.setDate(expiresAt.getDate() + days);

            await db.update(organizations).set({
              maxLocations: meta.tariffId === "business" ? 5 : 1,
              tariffId: meta.tariffId,
              tariffExpiresAt: expiresAt,
              trialEndsAt: null
            }).where(eq(organizations.id, meta.orgId));
          }
        }
      } 
      else if (event.event === "payment.canceled") {
        await db.update(payments).set({ status: "canceled", updatedAt: new Date() }).where(eq(payments.yookassaId, event.object.id));
      }
      return reply.send({ ok: true });
    } catch (e: any) { app.log.error(e); return reply.code(500).send({ error: "Internal Error" }); }
  });

  // ─── MAX Bot Webhook ──────────────────────────────
  app.post("/max", async (req, reply) => {
    const body = req.body as any;
    app.log.info({ body }, "MAX webhook received"); // 🔍 Логируем всё, что приходит от MAX

    try {
      const updateType = body.update_type;
      const message = body.message;
      
      const sender = message?.sender || body.user;
      const senderId = sender?.user_id?.toString();
      const botId = message?.recipient?.user_id?.toString() || body.bot_id?.toString();
      const text = message?.body?.text || "";

      // 1. ОБРАБОТКА БОТА ПОДДЕРЖКИ
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (senderId === SUPPORT_ADMIN_ID && text.startsWith("#") && SUPPORT_BOT_TOKEN) {
        const spaceIdx = text.indexOf(" ");
        const shortId = text.substring(1, spaceIdx > -1 ? spaceIdx : text.length).toUpperCase();
        const replyText = spaceIdx > -1 ? text.substring(spaceIdx + 1) : "";
        const tickets = await db.select().from(supportTickets);
        const ticket = tickets.find((t) => t.id.slice(0, 6).toUpperCase() === shortId);
        
        if (ticket) {
          await db.insert(supportMessages).values({ ticketId: ticket.id, sender: "ADMIN", text: replyText });
          await db.update(supportTickets).set({ status: "ANSWERED" }).where(eq(supportTickets.id, ticket.id));
          if (ticket.userId) {
            const [messenger] = await db.select().from(userMessengers).where(and(eq(userMessengers.userId, ticket.userId), eq(userMessengers.provider, "max")));
            if (messenger && messenger.externalId) {
              await axios.post(`https://botapi.max.ru/messages?user_id=${messenger.externalId}`, { text: "Ответ поддержки:\n\n" + replyText }, { headers: { Authorization: SUPPORT_BOT_TOKEN } }).catch(() => {});
            }
          }
          await axios.post(`https://botapi.max.ru/messages?user_id=${SUPPORT_ADMIN_ID}`, { text: "✅ Ответ на #" + shortId + " отправлен клиенту!" }, { headers: { Authorization: SUPPORT_BOT_TOKEN } }).catch(() => {});
        }
        return reply.send({ ok: true });
      }

      // 2. ОБРАБОТКА БОТА ОРГАНИЗАЦИИ (УВЕДОМЛЕНИЯ)
      if ((updateType === "message_created" || updateType === "bot_started") && senderId) {
        
        let org: { token: string | null } | undefined;

        // Пытаемся найти организацию по ID бота
        if (botId) {
          const [found] = await db.select({ token: organizations.maxBotToken }).from(organizations).where(eq(organizations.maxBotId, botId));
          org = found;
        }
        
        // 🔥 Страховка: если не нашли по ID (например, не сохранился), берем любой токен из базы
        if (!org) {
          const [fallback] = await db.select({ token: organizations.maxBotToken }).from(organizations).where(isNotNull(organizations.maxBotToken)).limit(1);
          org = fallback;
        }

        if (org && org.token) {
          const isStart = updateType === "bot_started" || text.trim() === "/start";

          if (isStart) {
            const replyText = `Привет! Твой ID в MAX:\n\n${senderId}\n\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.`;
            
            // MAX больше не принимает access_token в URL. Только в заголовке Authorization.
            await axios.post(
              `https://botapi.max.ru/messages?user_id=${senderId}`, 
              { text: replyText },
              { headers: { Authorization: org.token, "Content-Type": "application/json" } }
            ).catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));
          } else if (text.trim()) {
            await axios.post(
              `https://botapi.max.ru/messages?user_id=${senderId}`, 
              { text: "Это бот для уведомлений. Чтобы получить свой ID и привязать аккаунт, отправьте /start" },
              { headers: { Authorization: org.token, "Content-Type": "application/json" } }
            ).catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));
          }
        } else {
          app.log.warn("Не найден токен бота для ответа на вебхук");
        }
      }

      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Internal Error" });
    }
  });
}
