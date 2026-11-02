// superpatch-wallet-mock.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function readN(p) {
  const raw = fs.readFileSync(path.join(ROOT, p), "utf-8");
  const hadCRLF = raw.includes("\r\n");
  return { content: raw.replace(/\r\n/g, "\n"), hadCRLF };
}
function writeN(p, data) {
  const out = data.hadCRLF ? data.content.replace(/\n/g, "\r\n") : data.content;
  fs.writeFileSync(path.join(ROOT, p), out, "utf-8");
  console.log(`✔ ${p}`);
}
function patch(p, replaces) {
  const data = readN(p);
  let c = data.content;
  let touched = false;
  for (const [from, to] of replaces) {
    if (c.includes(from)) { c = c.replace(from, to); touched = true; }
  }
  if (touched) { data.content = c; writeN(p, data); }
  else console.log(`⚠ ${p} (не найдено)`);
}

// ═══════════════════════════════════════════════════════════════
// 1. Bэкенд: lib/yookassa.ts — добавляем мок-режим для локалки
// ═══════════════════════════════════════════════════════════════
patch("src/lib/yookassa.ts", [
  [
    `  async createPayment(input: CreatePaymentInput) {
    const idempotenceKey = crypto.randomUUID();`,
    `  async createPayment(input: CreatePaymentInput) {
    // 🛡️ Если ключей нет (локальная разработка) — имитируем оплату
    if (!SHOP_ID || !SECRET_KEY) {
      console.log("⚠️ [YooKassa] Ключи не заданы. Имитация успешной оплаты.");
      return {
        id: "test_" + Date.now(),
        status: "pending",
        amount: { value: input.amount.toFixed(2), currency: "RUB" },
        confirmation: {
          confirmation_url: \`\${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success\`,
        },
        description: input.description,
        metadata: input.metadata || {},
      };
    }

    const idempotenceKey = crypto.randomUUID();`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 2. Бэкенд: payments.routes.ts — более понятная ошибка
// ═══════════════════════════════════════════════════════════════
patch("src/modules/payments/payments.routes.ts", [
  [
    `    } catch (e: any) {
      app.log.error(e?.response?.data ?? e);
      return reply.code(500).send({
        error: "Ошибка создания платежа",
        details: e?.response?.data?.description ?? e?.message,
      });
    }`,
    `    } catch (e: any) {
      app.log.error(e?.response?.data ?? e);
      return reply.code(500).send({
        error: "Ошибка создания платежа. Проверьте настройки ЮKassa в .env",
        details: e?.response?.data?.description ?? e?.message,
      });
    }`
  ]
]);

console.log("\n✅ Мок-режим для оплаты добавлен!");
console.log("Теперь при отсутствии ключей ЮKassa оплата будет имитироваться.");
console.log("Не забудьте перезапустить бэкенд.");