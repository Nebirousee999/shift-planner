import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages, users, organizations } from "../../../db/schema.js";
import crypto from "node:crypto";

const ADMIN_EMAIL = "prihodko999@inbox.ru";

export async function supportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch (e) {}
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
      } else {
        // 🔥 Если зареген, но тикета нет — генерируем НОВЫЙ токен, игнорируя старый гостевой
        sessionToken = crypto.randomUUID();
      }
    } else {
      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) {
        if (found[0].email === parsed.data.email) ticket = found[0];
        else sessionToken = crypto.randomUUID();
      } else {
        // 🔥 Если куки сброшены, ищем старый тикет по почте (для гостей)
        const foundByEmail = await db.select().from(supportTickets)
          .where(and(eq(supportTickets.email, parsed.data.email), isNull(supportTickets.userId)))
          .orderBy(desc(supportTickets.createdAt)).limit(1);
        if (foundByEmail.length > 0) {
          ticket = foundByEmail[0];
          await db.update(supportTickets).set({ sessionToken }).where(eq(supportTickets.id, ticket.id));
        }
      }
    }

    if (!ticket) {
      const inserted = await db.insert(supportTickets).values({ userId, email: parsed.data.email, sessionToken, status: "OPEN", message: parsed.data.message }).returning();
      ticket = inserted[0];
    }

    await db.insert(supportMessages).values({ ticketId: ticket.id, sender: "USER", text: parsed.data.message, images: parsed.data.images, isReadByAdmin: false });
    
    return { success: true, ticketId: ticket.id.slice(0, 6).toUpperCase(), sessionToken: ticket.sessionToken };
  });

  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    const userId = (req as any).user?.sub || null;
    let ticket;
    
    if (userId) {
      // 🔥 Если зареген, ищем ТОЛЬКО по userId. Никаких fallback на куки.
      const found = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)).limit(1);
      if (found.length > 0) ticket = found[0];
    } else if (sessionToken) {
      // 🔥 Если гость, ищем по кукам
      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) ticket = found[0];
    }
    
    if (!ticket) return [];
    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)).orderBy(supportMessages.createdAt);
  });

  // ─── АДМИНСКИЕ РОУТЫ ──────────
  const checkAdmin = async (userId: string) => {
    if (!userId) return false;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.email === ADMIN_EMAIL;
  };

  app.get("/admin/unread-count", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });
    
    const unread = await db.select().from(supportMessages).where(
      and(eq(supportMessages.sender, "USER"), eq(supportMessages.isReadByAdmin, false))
    );
    return { count: unread.length };
  });

  app.get("/admin/tickets", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });

    const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    const allMessages = await db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt));
    const orgs = await db.select().from(organizations);
    const usersList = await db.select().from(users);

    const userMap = new Map(usersList.map(u => [u.id, u]));
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    const unreadCounts = new Map();
    for (const m of allMessages) {
      if (m.sender === "USER" && !m.isReadByAdmin) {
        unreadCounts.set(m.ticketId, (unreadCounts.get(m.ticketId) || 0) + 1);
      }
    }

    const uniqueTickets = new Map();
    for (const t of tickets) {
      if (!uniqueTickets.has(t.email)) {
        const lastMsg = allMessages.find(m => m.ticketId === t.id);
        const unreadCount = unreadCounts.get(t.id) || 0;
        
        let isRegistered = false;
        let tariffId = null;
        
        if (t.userId && userMap.has(t.userId)) {
          isRegistered = true;
          const u = userMap.get(t.userId);
          if (u && u.orgId) {
            const org = orgMap.get(u.orgId);
            tariffId = org?.tariffId || "free";
          }
        }

        uniqueTickets.set(t.email, {
          ...t,
          lastMessage: lastMsg?.text || t.message || "...",
          unreadCount,
          isRegistered,
          tariffId
        });
      }
    }
    return Array.from(uniqueTickets.values());
  });

  app.get("/admin/tickets/:id/messages", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });
    
    const { id } = req.params as { id: string };
    
    await db.update(supportMessages).set({ isReadByAdmin: true }).where(and(eq(supportMessages.ticketId, id), eq(supportMessages.sender, "USER")));
    
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

    await db.insert(supportMessages).values({ ticketId: id, sender: "ADMIN", text: parsed.data.text, isReadByAdmin: true });
    await db.update(supportTickets).set({ status: "ANSWERED" }).where(eq(supportTickets.id, id));
    
    return { success: true };
  });
}
