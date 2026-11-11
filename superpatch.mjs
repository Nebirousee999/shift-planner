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

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  
  if (search instanceof RegExp) {
    if (search.test(content)) {
      content = content.replace(search, replace);
      fs.writeFileSync(filePath, content, "utf-8");
      touched++;
      console.log("✅ [" + label + "] Применено (Regex)");
    } else {
      console.log("⏭  [" + label + "] Не найдено");
    }
    return;
  }

  if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⏭  [" + label + "] Не найдено");
  }
}

// ═══ 1. Бэкенд: Полностью чистая поддержка (без почты и MAX) ═══
writeFile(
  "src/modules/support/support.routes.ts",
  `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages, users } from "../../../db/schema.js";
import crypto from "node:crypto";

const ADMIN_EMAIL = "prihodko999@inbox.ru";

export async function supportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch (e) {
      // Guest
    }
  });

  // ─── КЛИЕНТСКИЕ РОУТЫ ───────────────────────────────
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
      const found = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)).limit(1);
      if (found.length > 0) {
        ticket = found[0];
        if (ticket.sessionToken !== sessionToken) {
          const tokenBusy = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
          if (tokenBusy.length === 0) {
            await db.update(supportTickets).set({ sessionToken }).where(eq(supportTickets.id, ticket.id));
            ticket.sessionToken = sessionToken;
          } else {
            sessionToken = ticket.sessionToken;
          }
        }
      }
    } else {
      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) {
        if (found[0].email === parsed.data.email) ticket = found[0];
        else sessionToken = crypto.randomUUID();
      }
    }

    if (!ticket) {
      try {
        const inserted = await db.insert(supportTickets).values({ userId, email: parsed.data.email, sessionToken, status: "OPEN", message: parsed.data.message }).returning();
        ticket = inserted[0];
      } catch (err: any) {
        if (err.code === '23505') {
          sessionToken = crypto.randomUUID();
          const inserted = await db.insert(supportTickets).values({ userId, email: parsed.data.email, sessionToken, status: "OPEN", message: parsed.data.message }).returning();
          ticket = inserted[0];
        } else throw err;
      }
    }

    await db.insert(supportMessages).values({ ticketId: ticket.id, sender: "USER", text: parsed.data.message, images: parsed.data.images });
    
    return { success: true, ticketId: ticket.id.slice(0, 6).toUpperCase(), sessionToken: ticket.sessionToken };
  });

  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    const userId = (req as any).user?.sub || null;
    let ticket;
    if (userId) {
      const found = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)).limit(1);
      if (found.length > 0) ticket = found[0];
    }
    if (!ticket && sessionToken) {
      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) ticket = found[0];
    }
    if (!ticket) return [];
    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)).orderBy(supportMessages.createdAt);
  });

  // ─── АДМИНСКИЕ РОУТЫ (Панель разработчика) ──────────
  const checkAdmin = async (userId: string) => {
    if (!userId) return false;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.email === ADMIN_EMAIL;
  };

  app.get("/admin/tickets", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });

    const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    const allMessages = await db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt));
    
    const uniqueTickets = new Map();
    for (const t of tickets) {
      if (!uniqueTickets.has(t.email)) {
        const lastMsg = allMessages.find(m => m.ticketId === t.id);
        uniqueTickets.set(t.email, { ...t, lastMessage: lastMsg?.text || t.message || "..." });
      }
    }
    return Array.from(uniqueTickets.values());
  });

  app.get("/admin/tickets/:id/messages", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });
    const { id } = req.params as { id: string };
    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)).orderBy(supportMessages.createdAt);
  });

  app.post("/admin/tickets/:id/reply", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });

    const { id } = req.params as { id: string };
    const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Empty message" });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) return reply.code(404).send({ error: "Ticket not found" });

    await db.insert(supportMessages).values({ ticketId: id, sender: "ADMIN", text: parsed.data.text });
    await db.update(supportTickets).set({ status: "ANSWERED" }).where(eq(supportTickets.id, id));
    
    return { success: true };
  });
}
`,
  "src/modules/support/support.routes.ts"
);

// ═══ 2. Вебхук: Убираем логику ответов на тикеты (чтобы бот не реагировал на #ID) ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  /if \(senderId === SUPPORT_ADMIN_ID && text\.startsWith\("#"\)[\s\S]*?return reply\.send\(\{ ok: true \}\);\n          \}/,
  ``,
  "webhooks.routes.ts (удаление логики поддержки)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Поддержка полностью изолирована на сайте.");
} else {
  console.log("⚠️ Изменений не внесено.");
}