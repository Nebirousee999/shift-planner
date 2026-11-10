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
    console.log("⚠️ [" + label + "] Не найдено (возможно, уже изменено).");
  }
}

function createFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Создан/Обновлён");
}

// ═══ 1. Добавляем переменные в .env и .env.example ═══
const envPatch = `
# Бот для техподдержки (система тикетов)
SUPPORT_BOT_TOKEN=
SUPPORT_ADMIN_ID=141744495
`;
if (fs.existsSync(".env") && !fs.readFileSync(".env", "utf-8").includes("SUPPORT_BOT_TOKEN")) {
  fs.appendFileSync(".env", envPatch);
  console.log("✅ [.env] Добавлены SUPPORT_BOT_TOKEN и SUPPORT_ADMIN_ID");
  touched++;
}
if (fs.existsSync(".env.example") && !fs.readFileSync(".env.example", "utf-8").includes("SUPPORT_BOT_TOKEN")) {
  fs.appendFileSync(".env.example", envPatch);
  console.log("✅ [.env.example] Добавлены переменные");
  touched++;
}

// ═══ 2. Обновляем API поддержки (support.routes.ts) ═══
createFile(
  "src/modules/support/support.routes.ts",
  `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets } from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import axios from "axios";

export async function supportRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const userId = (req as any).user?.sub || null;
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId,
        email: parsed.data.email,
        message: parsed.data.message,
        images: parsed.data.images,
      })
      .returning();
    const shortId = ticket.id.slice(0, 6).toUpperCase();

    await mailerService
      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId, parsed.data.images)
      .catch((e) => app.log.error(e));

    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (SUPPORT_BOT_TOKEN) {
        await axios.post(
          \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,
          {
            text:
              "📩 Обращение #" + shortId + "\\n" +
              "От: " + parsed.data.email + "\\n\\n" +
              parsed.data.message + "\\n\\n" +
              "Чтобы ответить, напишите:\\n#" + shortId + " ваш ответ",
          },
          { headers: { Authorization: SUPPORT_BOT_TOKEN } }
        );

        if (parsed.data.images.length > 0) {
          await axios.post(
            \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,
            { text: "📎 Клиент прикрепил " + parsed.data.images.length + " фото. Они отправлены вам на почту." },
            { headers: { Authorization: SUPPORT_BOT_TOKEN } }
          );
        }
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX support send failed");
    }

    return { success: true, ticketId: shortId };
  });

  app.get("/my", async (req) => {
    const userId = (req as any).user?.sub;
    if (!userId) return [];
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  });
}
`,
  "src/modules/support/support.routes.ts"
);

// ═══ 3. Обновляем вебхук (webhooks.routes.ts) ═══
// Перехватываем ответ от админа ДО того, как система начнет искать организацию.
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `      const recipient = message?.recipient;\n      let botId = recipient?.user_id?.toString() || body.bot_id?.toString();`,
  `      const recipient = message?.recipient;\n      let botId = recipient?.user_id?.toString() || body.bot_id?.toString();\n\n      // ─── ОБРАБОТКА ОТВЕТА АДМИНА ПОДДЕРЖКИ ───\n      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;\n      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";\n      const text = message?.body?.text || "";\n\n      if (senderId === SUPPORT_ADMIN_ID && text.startsWith("#") && SUPPORT_BOT_TOKEN) {\n        const spaceIdx = text.indexOf(" ");\n        const shortId = text.substring(1, spaceIdx > -1 ? spaceIdx : text.length).toUpperCase();\n        const replyText = spaceIdx > -1 ? text.substring(spaceIdx + 1) : "";\n        \n        const tickets = await db.select().from(supportTickets);\n        const ticket = tickets.find((t) => t.id.slice(0, 6).toUpperCase() === shortId);\n        \n        if (ticket) {\n          await db\n            .update(supportTickets)\n            .set({ reply: replyText, status: "ANSWERED" })\n            .where(eq(supportTickets.id, ticket.id));\n          await mailerService.sendSupportReply(ticket.email, replyText).catch(() => {});\n          \n          if (ticket.userId) {\n            await axios\n              .post(\n                \`https://botapi.max.ru/messages?user_id=\${ticket.userId}\`,\n                { text: "Ответ поддержки:\\n\\n" + replyText },\n                { headers: { Authorization: SUPPORT_BOT_TOKEN } }\n              )\n              .catch(() => {});\n          }\n          \n          await axios\n            .post(\n              \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,\n              { text: "✅ Ответ на #" + shortId + " отправлен клиенту!" },\n              { headers: { Authorization: SUPPORT_BOT_TOKEN } }\n            )\n            .catch(() => {});\n        }\n        return reply.send({ ok: true });\n      }`,
  "webhooks.routes.ts (перехват ответа поддержки)"
);

// Убираем старый обработчик ответа поддержки изнутри блока org (если он там остался)
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  /          \/\/ Ответ на тикет: формат "#SHORTID текст"[\s\S]*?return reply.send\(\{ ok: true \}\);\n          \}/,
  ``,
  "webhooks.routes.ts (удаление старого дубля)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}