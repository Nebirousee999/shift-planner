import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../../db/client.js";
import { payments, users } from "../../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { yookassaService } from "../../lib/yookassa.js";
import { paymentsService } from "./payments.service.js";

const createSchema = z.object({
  tariffId: z.enum(["pro", "business"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(255),
});

// Цены для проверки (защита от подмены суммы на фронте)
const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480, 1, 2], // 1 и 2 ₽ — для тестовой оплаты
  business: [2490, 23880, 1, 2],
};

export async function paymentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/create", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { tariffId, amount, description } = parsed.data;
    const { sub: userId, orgId } = req.user!;

    // Проверяем сумму на сервере — не доверяем фронту
    if (TARIFF_PRICES[tariffId] && !TARIFF_PRICES[tariffId].includes(amount)) {
      return reply.code(400).send({ error: "Неверная сумма для тарифа" });
    }
    // Определяем год по сумме ИЛИ по слову "год" в описании (для тестов)
    const isYearly = amount > 5000 || description.toLowerCase().includes("год");
    const periodDays = isYearly ? 365 : 30;

    try {
      // 🔥 Получаем email пользователя для чека по 54-ФЗ
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
      const email = user?.email || "test@shift-planner.ru";

      const payment = await yookassaService.createPayment({
        amount,
        description,
        returnUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success`,
        metadata: {
          userId,
          orgId,
          tariffId,
          periodDays: periodDays.toString(),
          isYearly: isYearly.toString(),
        },
        // 🔥 Формируем чек для ЮKassa
        receipt: {
          customer: { email },
          items: [
            {
              description: description,
              quantity: "1.00",
              amount: { value: amount.toFixed(2), currency: "RUB" },
              vat_code: 1, // 1 = Без НДС (если у тебя ОСНО и 20%, поменяй на 4)
              payment_subject: "service",
              payment_mode: "full_payment",
            },
          ],
        },
      });

      // Сохраняем в БД
      await db.insert(payments).values({
        userId,
        yookassaId: payment.id,
        amount: amount.toFixed(2),
        status: payment.status,
        description,
        metadata: { 
          tariffId, 
          orgId, 
          periodDays: periodDays.toString(), 
          isYearly: isYearly.toString() 
        }, // 🔥 ТЕПЕРЬ СОХРАНЯЕМ ПЕРИОД В БАЗУ
      });

      return {
        paymentId: payment.id,
        confirmationUrl: payment.confirmation.confirmation_url,
      };
    } catch (e: any) {
      app.log.error(e?.response?.data ?? e);
      return reply.code(500).send({
        error: "Ошибка создания платежа. Проверьте настройки ЮKassa в .env",
        details: e?.response?.data?.description ?? e?.message,
      });
    }
  });

  app.post("/start-trial", async (req, reply) => {
    const { orgId } = req.user!;
    try {
      const { db } = await import("../../../db/client.js");
      const { organizations } = await import("../../../db/schema.js");
      const { eq } = await import("drizzle-orm");

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await db.update(organizations).set({
        trialEndsAt,
        tariffId: "pro",
      }).where(eq(organizations.id, orgId));

      return { success: true, trialEndsAt };
    } catch (e: any) {
      return reply.code(500).send({ error: "Ошибка активации триала" });
    }
  });

  app.get("/current", async (req) => {
    const { orgId } = req.user!;
    return paymentsService.current(orgId);
  });

  // История платежей пользователя
  app.get("/history", async (req) => {
    const { sub: userId } = req.user!;
    const { eq, desc } = await import("drizzle-orm");
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  });
}