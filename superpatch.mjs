// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function writeFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Полностью перезаписан");
}

// ═══ 1. API Поддержки (Полностью без почты, только MAX) ═══
writeFile(
  "src/modules/support/support.routes.ts",
  `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages } from "../../../db/schema.js";
import axios from "axios";
import crypto from "node:crypto";

export async function supportRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
      sessionToken: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const userId = (req as any).user?.sub || null;
    let { sessionToken } = parsed.data;
    if (!sessionToken) sessionToken = crypto.randomUUID();

    let [ticket];

    // 1. Если пользователь авторизован, ищем его последний тикет
    if (userId) {
      [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);

      if (ticket && ticket.sessionToken !== sessionToken) {
        await db.update(supportTickets)
          .set({ sessionToken })
          .where(eq(supportTickets.id, ticket.id));
      }
    }

    // 2. Если не нашли (или гость), ищем по сессии
    if (!ticket) {
      [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
    }

    // 3. Создаем новый, если нет
    if (!ticket) {
      [ticket] = await db
        .insert(supportTickets)
        .values({
          userId,
          email: parsed.data.email,
          sessionToken,
          status: "OPEN",
          message: parsed.data.message, // Для совместимости со старой БД
        })
        .returning();
    }

    // Сохраняем сообщение в историю
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    // Отправляем уведомление в MAX (только через бота поддержки!)
    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (!SUPPORT_BOT_TOKEN) {
        app.log.error("❌ ОШИБКА: SUPPORT_BOT_TOKEN не задан в .env!");
        return reply.code(500).send({ error: "Support bot token missing" });
      }

      await axios.post(
        \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,
        {
          text: "📩 Чат поддержки #" + shortId + "\\n" +
                (userId ? "Пользователь: " + parsed.data.email : "Гость: " + parsed.data.email) + "\\n\\n" +
                parsed.data.message + "\\n\\n" +
                "Чтобы ответить, напишите:\\n#" + shortId + " ваш ответ",
        },
        { headers: { Authorization: SUPPORT_BOT_TOKEN } }
      );
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken };
  });

  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    const userId = (req as any).user?.sub || null;

    let [ticket];

    if (userId) {
      [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
    }

    if (!ticket && sessionToken) {
      [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
    }

    if (!ticket) return [];

    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticket.id))
      .orderBy(supportMessages.createdAt);
  });
}
`,
  "support.routes.ts"
);

// ═══ 2. Webhook (Обработка ответов админа без почты) ═══
// Мы не перезаписываем весь файл, так как там еще ЮKassa, 
// поэтому точечно вырезаем почту и правим отправку.
const webhookPath = path.join(ROOT, "src/modules/webhooks/webhooks.routes.ts");
if (fs.existsSync(webhookPath)) {
  let content = fs.readFileSync(webhookPath, "utf-8");
  
  // Убираем вызов mailerService, если он там есть
  content = content.replace(/await mailerService\.sendSupportReply\([\s\S]*?\)\.catch\(\(\) => \{\}\);/g, "");

  // Обновляем отправку сообщения обратно клиенту (гарантируем использование SUPPORT_BOT_TOKEN)
  content = content.replace(
    /await axios\s*\.post\(\s*`https:\/\/botapi\.max\.ru\/messages\?user_id=\$\{ticket\.userId\}`,\s*\{ text: "Ответ поддержки:\\\\n\\\\n" \+ replyText \},\s*\{ headers: \{ Authorization: org\.token \} \}\s*\)\s*\.catch\(\(\) => \{\}\);/g,
    `await axios\n              .post(\n                \`https://botapi.max.ru/messages?user_id=\${ticket.userId}\`,\n                { text: "Ответ поддержки:\\n\\n" + replyText },\n                { headers: { Authorization: process.env.SUPPORT_BOT_TOKEN } }\n              )\n              .catch(() => {});`
  );

  // Обновляем уведомление админу об успешной отправке
  content = content.replace(
    /await axios\s*\.post\(\s*`https:\/\/botapi\.max\.ru\/messages\?user_id=\$\{SUPPORT_ADMIN_ID\}`,\s*\{ text: "✅ Ответ на #" \+ shortId \+ " отправлен клиенту!" \},\s*\{ headers: \{ Authorization: org\.token \} \}\s*\)\s*\.catch\(\(\) => \{\}\);/g,
    `await axios\n            .post(\n              \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,\n              { text: "✅ Ответ на #" + shortId + " отправлен клиенту!" },\n              { headers: { Authorization: process.env.SUPPORT_BOT_TOKEN } }\n            )\n            .catch(() => {});`
  );

  fs.writeFileSync(webhookPath, content, "utf-8");
  touched++;
  console.log("✅ [webhooks.routes.ts] Очищен от почты и переведен на SUPPORT_BOT_TOKEN");
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
  console.log("⚠️ ВАЖНО: Убедись, что на сервере в .env есть SUPPORT_BOT_TOKEN!");
} else {
  console.log("⚠️ Изменений не внесено.");
}