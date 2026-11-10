import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "src/modules/webhooks/webhooks.routes.ts");

if (!fs.existsSync(filePath)) {
  console.log("❌ Файл webhooks.routes.ts не найден!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const hadCRLF = content.includes("\r\n");
let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

// Заменяем блок обработки message_created
const searchBlock = `      if ((updateType === "message_created" || updateType === "bot_started") && senderId && botId) {
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
      }`;

const replaceBlock = `      if ((updateType === "message_created" || updateType === "bot_started") && senderId && botId) {
        const [org] = await db
          .select({ token: organizations.maxBotToken })
          .from(organizations)
          .where(eq(organizations.maxBotId, botId));

        if (org && org.token) {
          const text = message?.body?.text || "";
          const ADMIN_ID = "141744495"; // Твой личный ID в MAX

          // Если пишет сам админ, бот просто сохраняет ID (для привязки)
          if (senderId === ADMIN_ID) {
            const replyText = \`Привет! Твой ID в MAX:\\n\\n\${senderId}\\n\\nСкопируй его и вставь в настройках профиля на сайте (Профиль -> Мессенджер), чтобы получать уведомления.\`;
            await axios.post(\`https://botapi.max.ru/messages?user_id=\${senderId}\`, { text: replyText }, { headers: { Authorization: org.token } });
          } 
          // Если пишет клиент — пересылаем тебе в ЛС
          else {
            // 1. Отвечаем клиенту
            await axios.post(
              \`https://botapi.max.ru/messages?user_id=\${senderId}\`,
              { text: \`Спасибо! Ваше сообщение передано в поддержку. Мы ответим вам в ближайшее время.\` },
              { headers: { Authorization: org.token } }
            );

            // 2. Пересылаем сообщение Админу
            const forwardText = \`📩 Новое сообщение в поддержку!\\n\\nОт: \${sender?.name || 'Пользователь'} (ID: \${senderId})\\nТекст: \${text}\`;
            await axios.post(
              \`https://botapi.max.ru/messages?user_id=\${ADMIN_ID}\`,
              { text: forwardText },
              { headers: { Authorization: org.token } }
            );
            app.log.info({ senderId }, "✅ Сообщение клиента переслано админу");
          }
        } else {
          app.log.warn({ botId }, "❌ Бот не найден в БД или отсутствует токен");
        }
      }`;

if (normalized.includes(searchBlock)) {
  normalized = normalized.replace(searchBlock, replaceBlock);
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log("✅ [webhooks.routes.ts] Бот настроен как служба поддержки (пересылает сообщения админу).");
} else {
  console.log("❌ Не удалось найти блок с обработкой сообщений. Возможно, код уже изменен.");
}