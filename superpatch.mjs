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

// ═══════════════════════════════════════════════════════════════
// 1. Обновляем схему БД (добавляем maxBotId)
// ═══════════════════════════════════════════════════════════════
patchFile(
  "db/schema.ts",
  `  maxBotLink: varchar("max_bot_link", { length: 255 }),`,
  `  maxBotLink: varchar("max_bot_link", { length: 255 }),
  maxBotId: varchar("max_bot_id", { length: 255 }),`,
  "db/schema.ts (добавлена колонка maxBotId)"
);

// Создаем файл миграции для PostgreSQL
const migrationPath = path.join(ROOT, "db/migrations/0019_max_bot_id.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_bot_id" varchar(255);`);
  console.log("✅ [db/migrations/0019_max_bot_id.sql] Создана миграция для колонки maxBotId.");
  touched++;
}

// ═══════════════════════════════════════════════════════════════
// 2. Обновляем типы на фронтенде
// ═══════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/api/organization.ts",
  `  maxBotToken?: string | null;`,
  `  maxBotToken?: string | null;
  maxBotId?: string | null;`,
  "organization.ts (тип maxBotId)"
);

// ═══════════════════════════════════════════════════════════════
// 3. Логика получения ID бота при сохранении токена
// ═══════════════════════════════════════════════════════════════
const orgServicePath = path.join(ROOT, "src/modules/organization/organization.service.ts");
if (fs.existsSync(orgServicePath)) {
  let content = fs.readFileSync(orgServicePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (!normalized.includes("import axios")) {
    normalized = `import axios from "axios";\n` + normalized;
  }

  const searchUpdate = `    const [updated] = await db
      .update(organizations)
      .set({`;
  
  const replaceUpdate = `    // 🤖 Если передан токен, получаем ID бота
    let botId = undefined;
    if (input.maxBotToken) {
      try {
        const { data } = await axios.get("https://platform-api2.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        botId = data.id?.toString();
      } catch (e) {
        console.error("Ошибка получения ID бота MAX (проверьте токен):", e.message);
      }
    } else if (input.maxBotToken === null) {
      botId = null; // Сброс при удалении токена
    }

    const [updated] = await db
      .update(organizations)
      .set({
        ...(botId !== undefined && { maxBotId: botId }),`;

  if (normalized.includes(searchUpdate) && !normalized.includes("🤖 Если передан токен")) {
    normalized = normalized.replace(searchUpdate, replaceUpdate);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(orgServicePath, finalContent, "utf-8");
    touched++;
    console.log("✅ [organization.service.ts] Добавлено автоматическое получение maxBotId.");
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. Переписываем вебхук для поддержки множества ботов
// ═══════════════════════════════════════════════════════════════
const webhookPath = path.join(ROOT, "src/modules/webhooks/webhooks.routes.ts");
if (fs.existsSync(webhookPath)) {
  let content = fs.readFileSync(webhookPath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  // Удаляем старый роут /max, если он есть
  normalized = normalized.replace(/  \/\/ ─── MAX Bot Webhook ──────────────────────────────[\s\S]*?\n  \}\);\n/m, "");
  
  if (!normalized.includes('app.post("/max"')) {
    const maxRoute = `
  // ─── MAX Bot Webhook ──────────────────────────────
  app.post("/max", async (req, reply) => {
    try {
      const body = req.body as any;
      // MAX передает ID бота в корне или в recipient
      const botId = (body.bot_id || body.recipient?.bot_id || body.message?.recipient?.bot_id)?.toString();
      const senderId = body.message?.sender?.user_id?.toString();

      if (body.update_type === "message_created" && senderId && botId) {
        // Ищем организацию по ID бота
        const [org] = await db
          .select({ token: organizations.maxBotToken })
          .from(organizations)
          .where(eq(organizations.maxBotId, botId));

        if (org && org.token) {
          const replyText = \`Привет! Твой ID в MAX: <b>\${senderId}</b>\\n\\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.\`;
          await axios.post(
            \`https://botapi.max.ru/messages?user_id=\${senderId}\`,
            { text: replyText },
            { headers: { Authorization: org.token } }
          );
        } else {
          app.log.warn({ botId }, "Бот с таким ID не найден в БД или не имеет токена");
        }
      }
      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Internal Error" });
    }
  });
`;
    const lastBraceIndex = normalized.lastIndexOf("}");
    normalized = normalized.slice(0, lastBraceIndex) + maxRoute + "\n}";

    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(webhookPath, finalContent, "utf-8");
    touched++;
    console.log("✅ [webhooks.routes.ts] Вебхук переписан под мультитенантность (поиск по bot_id).");
  }
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}