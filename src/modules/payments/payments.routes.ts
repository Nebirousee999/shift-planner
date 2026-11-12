import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../../db/client.js";
import { payments } from "../../../db/schema.js";
import { yookassaService } from "../../lib/yookassa.js";
import { paymentsService } from "./payments.service.js";

const createSchema = z.object({
  tariffId: z.enum(["pro", "business"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(255),
});

// Цены для проверки (защита от подмены суммы на фронте)
const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480, 1], // 1 ₽ — для тестовой оплаты через реальный кошелёк
  business: [2490, 23880],
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
    const isYearly = amount > 5000;
    const periodDays = isYearly ? 365 : 30;

    try {
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
      });

      // Сохраняем в БД
      await db.insert(payments).values({
        userId,
        yookassaId: payment.id,
        amount: amount.toFixed(2),
        status: payment.status,
        description,
        metadata: { tariffId, orgId },
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