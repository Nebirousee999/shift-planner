import axios from 'axios';
import crypto from 'node:crypto';

const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

if (!SHOP_ID || !SECRET_KEY) {
  console.warn('⚠️ YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не заданы в .env');
}

const client = axios.create({
  baseURL: 'https://api.yookassa.ru/v3',
  auth: {
    username: SHOP_ID ?? '',
    password: SECRET_KEY ?? '',
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

export type CreatePaymentInput = {
  amount: number;
  currency?: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
};

export const yookassaService = {
  async createPayment(input: CreatePaymentInput) {
    // 🛡️ Если ключей нет (локальная разработка) — имитируем оплату
    if (!SHOP_ID || !SECRET_KEY) {
      console.log("⚠️ [YooKassa] Ключи не заданы. Имитация успешной оплаты.");
      return {
        id: "test_" + Date.now(),
        status: "pending",
        amount: { value: input.amount.toFixed(2), currency: "RUB" },
        confirmation: {
          confirmation_url: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success`,
        },
        description: input.description,
        metadata: input.metadata || {},
      };
    }

    const idempotenceKey = crypto.randomUUID();

    const { data } = await client.post(
      '/payments',
      {
        amount: {
          value: input.amount.toFixed(2),
          currency: input.currency ?? 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: input.returnUrl,
        },
        capture: true,
        description: input.description,
        metadata: input.metadata ?? {},
      },
      {
        headers: {
          'Idempotence-Key': idempotenceKey,
        },
      }
    );

    return data as {
      id: string;
      status: string;
      amount: { value: string; currency: string };
      confirmation: { confirmation_url: string };
      description: string;
      metadata: Record<string, string>;
    };
  },

  async getPayment(paymentId: string) {
    const { data } = await client.get(`/payments/${paymentId}`);
    return data as {
      id: string;
      status: 'pending' | 'succeeded' | 'canceled' | 'waiting_for_capture';
      paid: boolean;
      amount: { value: string; currency: string };
    };
  },
};