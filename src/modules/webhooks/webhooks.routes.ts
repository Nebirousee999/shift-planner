import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
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
        // 🛡️ БЕЗОПАСНОСТЬ: Проверяем статус платежа напрямую в API ЮKassa
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

        // 1. Обновляем статус платежа в нашей БД
        await db
          .update(payments)
          .set({ status: "succeeded", updatedAt: new Date() })
          .where(eq(payments.yookassaId, event.object.id));

        // 2. Выдаем доступ (опционально, если нужно обновить тариф организации)
        // Достаем платеж, чтобы узнать, какой тариф был куплен
        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.yookassaId, event.object.id));

        if (payment && payment.metadata) {
          const meta = payment.metadata as { orgId: string; tariffId: string };
          
          // Пример логики: если купили Business, даем 5 точек, иначе 1.
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

      // Обязательно подтверждаем получение, иначе ЮKassa будет слать повторно
      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      // Даже при ошибке БД лучше вернуть 200, чтобы ЮKassa не спамила,
      // либо 500, если хотим, чтобы она повторила попытку позже.
      return reply.code(500).send({ error: "Internal Error" });
    }
  });
}