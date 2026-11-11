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
  console.log("✅ [" + label + "] Перезаписан");
}

// ═══ Бэкенд: защита от дубликатов sessionToken ═══
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
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch (e) {
      // Guest
    }
  });

  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().min(1),
      images: z.array(z.string()).optional().default([]),
      sessionToken: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const userId = (req as any).user?.sub || null;
    let sessionToken = parsed.data.sessionToken || crypto.randomUUID();

    let ticket;

    if (userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      
      if (found.length > 0) {
        ticket = found[0];
        if (ticket.sessionToken !== sessionToken) {
          const tokenBusy = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
          if (tokenBusy.length === 0) {
            await db.update(supportTickets)
              .set({ sessionToken })
              .where(eq(supportTickets.id, ticket.id));
            ticket.sessionToken = sessionToken;
          } else {
            sessionToken = ticket.sessionToken; // Возвращаем старый, чтобы фронт перезаписал
          }
        }
      } else {
        const tokenBusy = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
        if (tokenBusy.length > 0) {
          sessionToken = crypto.randomUUID(); // Если токен занят, генерируем новый
        }
      }
    } else {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
      
      if (found.length > 0) {
        if (found[0].email === parsed.data.email) {
          ticket = found[0];
        } else {
          sessionToken = crypto.randomUUID();
        }
      }
    }

    if (!ticket) {
      const inserted = await db
        .insert(supportTickets)
        .values({
          userId,
          email: parsed.data.email,
          sessionToken,
          status: "OPEN",
          message: parsed.data.message,
        })
        .returning();
      ticket = inserted[0];
    } else {
      if (!ticket.message) {
         await db.update(supportTickets).set({ message: parsed.data.message }).where(eq(supportTickets.id, ticket.id));
      }
    }

    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";

      if (SUPPORT_BOT_TOKEN) {
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
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken: ticket.sessionToken };
  });

  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    const userId = (req as any).user?.sub || null;

    let ticket;

    if (userId) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      if (found.length > 0) ticket = found[0];
    } else if (sessionToken) {
      const found = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) ticket = found[0];
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
  "src/modules/support/support.routes.ts"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Исправлена ошибка дублирования sessionToken.");
} else {
  console.log("⚠️ Изменений не внесено.");
}