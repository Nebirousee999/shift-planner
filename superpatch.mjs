import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. Добавляем notificationSettings в метод profile (me.service.ts)
patchFile(
  "src/modules/me/me.service.ts",
  `        createdAt: users.createdAt,`,
  `        createdAt: users.createdAt,
        notificationSettings: users.notificationSettings,`,
  "me.service.ts (добавлен notificationSettings в profile)"
);

// 2. Оборачиваем весь роут bind в try/catch (me.routes.ts)
patchFile(
  "src/modules/me/me.routes.ts",
  `  app.post("/messengers/bind", async (req, reply) => {
    const parsed = bindMessengerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { sub: userId, orgId } = req.user!;

    // ─── Проверка тарифа: мессенджеры только на Pro и Business ───
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const now = new Date();
    const isTrial = org?.trialEndsAt && new Date(org.trialEndsAt) > now;
    const isPaid = org?.tariffExpiresAt && new Date(org.tariffExpiresAt) > now;
    const effectiveTariff = isTrial ? "pro" : (isPaid ? org?.tariffId : "free");

    if (effectiveTariff === "free") {
      return reply.code(403).send({
        error: "Уведомления в Telegram и MAX доступны на тарифе Pro. Обновите тариф в разделе «Кошелек».",
        code: "MESSENGER_NOT_AVAILABLE",
      });
    }
    const { provider, externalId } = parsed.data;

    try {`,
  `  app.post("/messengers/bind", async (req, reply) => {
    try {
      const parsed = bindMessengerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const { sub: userId, orgId } = req.user!;

      // ─── Проверка тарифа: мессенджеры только на Pro и Business ───
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      const now = new Date();
      const isTrial = org?.trialEndsAt && new Date(org.trialEndsAt) > now;
      const isPaid = org?.tariffExpiresAt && new Date(org.tariffExpiresAt) > now;
      const effectiveTariff = isTrial ? "pro" : (isPaid ? org?.tariffId : "free");

      if (effectiveTariff === "free") {
        return reply.code(403).send({
          error: "Уведомления в Telegram и MAX доступны на тарифе Pro. Обновите тариф в разделе «Кошелек».",
          code: "MESSENGER_NOT_AVAILABLE",
        });
      }
      const { provider, externalId } = parsed.data;`,
  "me.routes.ts (роут bind обернут в try/catch)"
);

// 3. Принудительно создаем миграцию заново, если ее нет
const migrationPath = path.join(ROOT, "db/migrations/0021_user_notification_settings.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;`);
  console.log("✅ [db/migrations/0021_user_notification_settings.sql] Создана миграция.");
  touched++;
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}