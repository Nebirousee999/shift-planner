import axios from "axios";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { organizations, users, locations, areas, scheduledShifts, scheduleWeeks, vacations, sickLeaves } from "../../../db/schema.js";
import { messengerService } from "../../lib/messenger.service.js";

export const organizationService = {
  async exportJson(orgId: string) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org || org.tariffId !== "business") throw new Error("FORBIDDEN");

    const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));
    const orgLocations = await db.select().from(locations).where(eq(locations.orgId, orgId));
    const orgAreas = await db.select().from(areas).where(eq(areas.orgId, orgId));
    const orgWeeks = await db.select().from(scheduleWeeks).where(eq(scheduleWeeks.orgId, orgId));
    const orgShifts = await db.select().from(scheduledShifts);
    const orgVacations = await db.select().from(vacations).where(eq(vacations.orgId, orgId));
    const orgSick = await db.select().from(sickLeaves).where(eq(sickLeaves.orgId, orgId));

    return {
      exportedAt: new Date().toISOString(),
      organization: org,
      users: orgUsers,
      locations: orgLocations,
      areas: orgAreas,
      scheduleWeeks: orgWeeks,
      scheduledShifts: orgShifts.filter(s => orgWeeks.some(w => w.id === s.weekId)),
      vacations: orgVacations,
      sickLeaves: orgSick,
    };
  },
  async broadcastBotLink(orgId: string) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org || !org.maxBotLink) throw new Error("Ссылка на бота не указана в настройках");

    const orgUsers = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.orgId, orgId));
    
    const { mailerService } = await import("../../lib/mailer.service.js");
    let sent = 0;
    for (const u of orgUsers) {
      let formattedLink = org.maxBotLink;
      if (formattedLink.startsWith('@')) {
        formattedLink = `https://max.ru/${formattedLink.slice(1)}`;
      } else if (!formattedLink.startsWith('http')) {
        formattedLink = `https://max.ru/${formattedLink}`;
      }
      const ok = await mailerService.sendBotLinkEmail(u.email, u.name, formattedLink);
      if (ok) sent++;
    }
    return { sent };
  },

  async get(orgId: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    return org ?? null;
  },

  async update(input: {
    orgId: string;
    name?: string;
    city?: string | null;
    directorName?: string | null;
    inn?: string | null;
    legalAddress?: string | null;
    timeTrackingEnabled?: boolean;
    overtimeMultiplier1?: string;
    overtimeMultiplier2?: string;
    taxRate?: string;
    positionHeaderOpacity?: number;
    positionRowOpacity?: number;
    requireShiftApproval?: boolean;
    disciplineEditWindowDays?: number;
    maxBotLink?: string | null;
    maxBotToken?: string | null;
  }) {
    const [before] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.orgId));

    // 🤖 Если передан токен, получаем ID бота и настраиваем вебхук
    let botId = undefined;
    if (input.maxBotToken) {
      try {
        const { data: botInfo } = await axios.get("https://botapi.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        if (!botInfo || !botInfo.user_id) {
          throw new Error("API MAX не вернул ID бота");
        }
        botId = botInfo.user_id.toString();

        // Автоматически подписываем бота на наш вебхук
        try {
          await axios.post("https://platform-api2.max.ru/subscriptions", {
            url: "https://shift-planner.ru/api/webhooks/max",
            update_types: ["message_created", "bot_started"],
            secret: "super_secret_webhook_key_123" // Можно сгенерировать случайный
          }, {
            headers: { 
              Authorization: input.maxBotToken,
              "Content-Type": "application/json"
            },
          });
          console.log(`✅ Бот ${botId} успешно подписан на вебхук`);
        } catch (webhookError) {
          console.error("Ошибка настройки вебхука MAX:", webhookError.response?.data || webhookError.message);
          // Не прерываем сохранение токена, просто логируем ошибку
        }
      } catch (e) {
        console.error("Ошибка получения ID бота MAX (проверьте токен):", e.message);
      }
    } else if (input.maxBotToken === null) {
      botId = null; // Сброс при удалении токена
    }

    const [updated] = await db
      .update(organizations)
      .set({
        ...(botId !== undefined && { maxBotId: botId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.directorName !== undefined && { directorName: input.directorName }),
        ...(input.inn !== undefined && { inn: input.inn }),
        ...(input.legalAddress !== undefined && { legalAddress: input.legalAddress }),
        ...(input.timeTrackingEnabled !== undefined && { timeTrackingEnabled: input.timeTrackingEnabled }),
        ...(input.overtimeMultiplier1 !== undefined && { overtimeMultiplier1: input.overtimeMultiplier1 }),
        ...(input.overtimeMultiplier2 !== undefined && { overtimeMultiplier2: input.overtimeMultiplier2 }),
        ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
        ...(input.positionHeaderOpacity !== undefined && { positionHeaderOpacity: input.positionHeaderOpacity }),
        ...(input.positionRowOpacity !== undefined && { positionRowOpacity: input.positionRowOpacity }),
        ...(input.requireShiftApproval !== undefined && { requireShiftApproval: input.requireShiftApproval }),
        ...(input.disciplineEditWindowDays !== undefined && { disciplineEditWindowDays: input.disciplineEditWindowDays }),
        ...(input.maxBotLink !== undefined && { maxBotLink: input.maxBotLink }),
        ...(input.maxBotToken !== undefined && { maxBotToken: input.maxBotToken }),
      })
      .where(eq(organizations.id, input.orgId))
      .returning();

    // 👇 Если изменилось окно редактирования дисциплины — уведомляем сотрудников
    if (
      input.disciplineEditWindowDays !== undefined &&
      before &&
      before.disciplineEditWindowDays !== input.disciplineEditWindowDays
    ) {
      const orgUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.orgId, input.orgId));

      const nowStr = new Date().toLocaleString("ru-RU");
      for (const u of orgUsers) {
        await messengerService.sendToUser(
          u.id,
          `<b>Изменение правил</b>\n\nРуководитель изменил срок, в течение которого можно вносить дисциплинарные изменения (опоздания, прогулы и т.д.).\nНовый срок: <b>${input.disciplineEditWindowDays} дн.</b>\n\nСоздано: ${nowStr}\n\nНажмите «ОК», чтобы подтвердить.`
        );
      }
    }

    return updated;
  },
};