// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  [${label}] файл не найден`); return; }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) { console.log(`⏭  [${label}] уже применено`); return; }

  if (!normalized.includes(search)) {
    console.log(`❌ [${label}] шаблон для замены не найден`);
    return;
  }

  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  touched++;
  console.log(`✅ [${label}] применено`);
}

// ════════════════════════════════════════════════════════════
// 1. БЭКЕНД: Добавляем поддержку receipt в yookassa.ts
// ════════════════════════════════════════════════════════════
patchFile(
  "src/lib/yookassa.ts",
  `export type CreatePaymentInput = {
  amount: number;
  currency?: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
};`,
  `export type CreatePaymentInput = {
  amount: number;
  currency?: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  receipt?: any;
};`,
  "yookassa.ts: тип CreatePaymentInput"
);

patchFile(
  "src/lib/yookassa.ts",
  `        capture: true,
        description: input.description,
        metadata: input.metadata ?? {},
      },`,
  `        capture: true,
        description: input.description,
        metadata: input.metadata ?? {},
        receipt: input.receipt,
      },`,
  "yookassa.ts: передача receipt в API ЮKassa"
);

// ════════════════════════════════════════════════════════════
// 2. БЭКЕНД: Формируем чек в payments.routes.ts
// ════════════════════════════════════════════════════════════
patchFile(
  "src/modules/payments/payments.routes.ts",
  `import { db } from "../../../db/client.js";
import { payments } from "../../../db/schema.js";`,
  `import { db } from "../../../db/client.js";
import { payments, users } from "../../../db/schema.js";
import { eq, desc } from "drizzle-orm";`,
  "payments.routes.ts: импорт users и eq"
);

patchFile(
  "src/modules/payments/payments.routes.ts",
  `    try {
      const payment = await yookassaService.createPayment({
        amount,
        description,
        returnUrl: \`\${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success\`,
        metadata: {
          userId,
          orgId,
          tariffId,
          periodDays: periodDays.toString(),
          isYearly: isYearly.toString(),
        },
      });`,
  `    try {
      // 🔥 Получаем email пользователя для чека по 54-ФЗ
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
      const email = user?.email || "test@shift-planner.ru";

      const payment = await yookassaService.createPayment({
        amount,
        description,
        returnUrl: \`\${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success\`,
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
      });`,
  "payments.routes.ts: генерация чека"
);

// Убираем дублирующийся динамический импорт eq, desc
patchFile(
  "src/modules/payments/payments.routes.ts",
  `  app.get("/history", async (req) => {
    const { sub: userId } = req.user!;
    const { eq, desc } = await import("drizzle-orm");`,
  `  app.get("/history", async (req) => {
    const { sub: userId } = req.user!;`,
  "payments.routes.ts: чистим дублирующийся импорт"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Чек для ЮKassa добавлен.");
} else {
  console.log("⚠️ Изменений не внесено.");
}