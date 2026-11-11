// superpatch.mjs
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

  if (normalized.includes(replace)) return;

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⚠️ [" + label + "] Не найдено.");
  }
}

function writeFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Создан/Перезаписан");
}

// ═══ 1. Исправляем вебхук (правильный поиск ID пользователя в MAX) ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `import { eq, isNotNull } from "drizzle-orm";`,
  `import { eq, isNotNull, and } from "drizzle-orm";`,
  "webhooks.routes.ts (импорт and)"
);

patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `import { payments, organizations, supportTickets, supportMessages } from "../../../db/schema.js";`,
  `import { payments, organizations, supportTickets, supportMessages, userMessengers } from "../../../db/schema.js";`,
  "webhooks.routes.ts (импорт userMessengers)"
);

patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `          if (ticket.userId) {\n            await axios\n              .post(\n                \`https://botapi.max.ru/messages?user_id=\${ticket.userId}\`,\n                { text: "Ответ поддержки:\\n\\n" + replyText },\n                { headers: { Authorization: SUPPORT_BOT_TOKEN } }\n              )\n              .catch(() => {});\n          }`,
  `          if (ticket.userId) {\n            const [messenger] = await db.select().from(userMessengers)\n              .where(and(eq(userMessengers.userId, ticket.userId), eq(userMessengers.provider, "max")));\n            \n            if (messenger && messenger.externalId) {\n              await axios\n                .post(\n                  \`https://botapi.max.ru/messages?user_id=\${messenger.externalId}\`,\n                  { text: "Ответ поддержки:\\n\\n" + replyText },\n                  { headers: { Authorization: SUPPORT_BOT_TOKEN } }\n                )\n                .catch(() => {});\n            }\n          }`,
  "webhooks.routes.ts (исправление отправки ответа)"
);

// ═══ 2. Создаем скрипт для регистрации Webhook ═══
writeFile(
  "set-webhook.mjs",
  `import axios from "axios";
import "dotenv/config";

const token = process.env.SUPPORT_BOT_TOKEN;
if (!token) {
  console.error("❌ SUPPORT_BOT_TOKEN не задан в .env");
  process.exit(1);
}

async function setWebhook() {
  try {
    await axios.post("https://platform-api2.max.ru/subscriptions", {
      url: "https://shift-planner.ru/api/webhooks/max",
      update_types: ["message_created", "bot_started"],
      secret: "super_secret_webhook_key_123"
    }, {
      headers: { Authorization: token, "Content-Type": "application/json" }
    });
    console.log("✅ Вебхук для бота поддержки успешно установлен!");
  } catch (e) {
    console.error("❌ Ошибка установки вебхука:", e.response?.data || e.message);
  }
}
setWebhook();
`,
  "set-webhook.mjs"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Код исправлен, создан скрипт set-webhook.mjs.");
} else {
  console.log("⚠️ Изменений не внесено.");
}