import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

const webhookPath = path.join(ROOT, "src/modules/webhooks/webhooks.routes.ts");
if (fs.existsSync(webhookPath)) {
  let content = fs.readFileSync(webhookPath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  // 1. Добавляем isNotNull в импорты, если его нет
  if (!normalized.includes("isNotNull")) {
    normalized = normalized.replace(
      `import { eq } from "drizzle-orm";`,
      `import { eq, isNotNull } from "drizzle-orm";`
    );
  }

  // 2. Полностью заменяем роут /max
  const startMarker = `  // ─── MAX Bot Webhook ──────────────────────────────`;
  const endMarker = `}`; // Конец функции webhooksRoutes

  const startIndex = normalized.indexOf(startMarker);
  const endIndex = normalized.lastIndexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    const newMaxRoute = `  // ─── MAX Bot Webhook ──────────────────────────────
  app.post("/max", async (req, reply) => {
    try {
      const body = req.body as any;
      const updateType = body.update_type;
      const message = body.message;
      
      const sender = message?.sender || body.user;
      const senderId = sender?.user_id?.toString();
      
      const recipient = message?.recipient;
      let botId = recipient?.user_id?.toString() || body.bot_id?.toString();

      // Если событие bot_started и MAX не передал ID бота, берем его из базы
      if (updateType === "bot_started" && !botId) {
        const [org] = await db.select({ id: organizations.maxBotId }).from(organizations).where(isNotNull(organizations.maxBotId)).limit(1);
        botId = org?.id || undefined;
      }

      // Обрабатываем и нажатие кнопки "Начать", и отправку сообщений
      if ((updateType === "message_created" || updateType === "bot_started") && senderId && botId) {
        const [org] = await db
          .select({ token: organizations.maxBotToken })
          .from(organizations)
          .where(eq(organizations.maxBotId, botId));

        if (org && org.token) {
          // Красивый текст без HTML-тегов и с переносом строки
          const replyText = \`Привет! Твой ID в MAX:\\n\\n\${senderId}\\n\\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.\`;
          
          await axios.post(
            \`https://botapi.max.ru/messages?user_id=\${senderId}\`,
            { text: replyText },
            { headers: { Authorization: org.token } }
          );
          app.log.info({ botId, senderId }, "✅ Отправлено приветственное сообщение в MAX");
        } else {
          app.log.warn({ botId }, "❌ Бот не найден в БД или отсутствует токен");
        }
      }
      return reply.send({ ok: true });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Internal Error" });
    }
  });
`;
    normalized = normalized.slice(0, startIndex) + newMaxRoute + normalized.slice(endIndex);
    
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(webhookPath, finalContent, "utf-8");
    touched++;
    console.log("✅ [webhooks.routes.ts] Вебхук MAX полностью переписан (кнопка Начать + форматирование).");
  } else {
    console.log("❌ Не удалось найти блок вебхука /max в файле.");
  }
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь можно коммитить и пушить.");
} else {
  console.log("⚠️ Изменений не внесено.");
}