import axios from "axios";
import { db } from "../../db/client.js";
import { userMessengers, users, organizations } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export type MessengerProvider = "telegram" | "max";

export const messengerService = {
  async sendToUser(userId: string, text: string): Promise<boolean> {
    console.log(`\n📨 [Messenger] Попытка отправки для userId: ${userId}`);

    // ─── Проверка тарифа: мессенджеры только на Pro и Business ───
    const [orgInfo] = await db
      .select({
        orgId: users.orgId,
        trialEndsAt: organizations.trialEndsAt,
        tariffId: organizations.tariffId,
        tariffExpiresAt: organizations.tariffExpiresAt,
        maxBotToken: organizations.maxBotToken,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(eq(users.id, userId));

    if (!orgInfo) return false;

    const now = new Date();
    const isTrial = orgInfo.trialEndsAt && new Date(orgInfo.trialEndsAt) > now;
    const isPaid = orgInfo.tariffExpiresAt && new Date(orgInfo.tariffExpiresAt) > now;
    const effectiveTariff = isTrial ? "pro" : (isPaid ? orgInfo.tariffId : "free");

    if (effectiveTariff === "free") {
      console.log(`⏭️ [Messenger] Пропуск: организация на Free тарифе`);
      return false;
    }
    
    const connections = await db
      .select()
      .from(userMessengers)
      .where(eq(userMessengers.userId, userId));

    console.log(`[Messenger] Найдено привязок: ${connections.length}`, connections.map(c => c.provider));

    if (connections.length === 0) {
      console.log(`❌ [Messenger] Нет привязанных мессенджеров`);
      return false;
    }

    let sent = false;
    for (const conn of connections) {
      try {
        if (conn.provider === "telegram") {
          console.log(`[Messenger] Отправка в Telegram (chat_id: ${conn.externalId})...`);
          await this.sendTelegram(conn.externalId, text);
          sent = true;
        } else if (conn.provider === "max") {
          console.log(`[Messenger] Отправка в MAX (user_id: ${conn.externalId})...`);
          await this.sendMax(conn.externalId, text);
          sent = true;
        }
        console.log(`✅ [Messenger] Успешно отправлено в ${conn.provider}`);
      } catch (err: any) {
        const errorDetail = err.response?.data 
          ? JSON.stringify(err.response.data) 
          : err.message;
        console.error(`❌ [Messenger] Ошибка отправки в ${conn.provider}:`, errorDetail);
      }
    }
    return sent;
  },

  // ─── Telegram ─────────────────────────────────────
  async sendTelegram(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      },
      { timeout: 10000 }
    );
  },

  // ─── MAX (Рабочая версия) ─────────────────────────
  async sendMax(userId: string, text: string) {
    const token = process.env.MAX_BOT_TOKEN;
    if (!token) throw new Error("MAX_BOT_TOKEN не задан");

    // ID получателя передаем в URL, токен — в заголовке (без Bearer)
    const url = `https://botapi.max.ru/messages?user_id=${userId}`;

    await axios.post(
      url,
      {
        text: text,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token,
        },
        timeout: 10000,
      }
    );
  },
};