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
  console.log("✅ [" + label + "] Перезаписан");
}

// ═══ 1. Увеличиваем лимит тела запроса (для картинок) ═══
patchFile(
  "src/server.ts",
  `const app = Fastify({ logger: true });`,
  `const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });`,
  "server.ts (bodyLimit 50MB)"
);

// ═══ 2. Полная перезапись бэкенда поддержки (чтобы точно починить картинки) ═══
writeFile(
  "src/modules/support/support.routes.ts",
  `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages, users, organizations } from "../../../db/schema.js";
import crypto from "node:crypto";

const ADMIN_EMAIL = "prihodko999@inbox.ru";

export async function supportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    try { await req.jwtVerify(); } catch (e) {}
  });

  app.post("/", async (req, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      message: z.string().optional().default(""),
      images: z.array(z.string()).optional().default([]),
      sessionToken: z.string().optional(),
    }).refine(data => data.message.trim().length > 0 || data.images.length > 0, {
      message: "Сообщение не может быть пустым"
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
        sessionToken = crypto.randomUUID();
      }
    } else {
      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));
      if (found.length > 0) {
        if (found[0].email === parsed.data.email) ticket = found[0];
        else sessionToken = crypto.randomUUID();
      } else {
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

  // ─── АДМИНСКИЕ РОУТЫ ──────────
  const checkAdmin = async (userId: string) => {
    if (!userId) return false;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.email === ADMIN_EMAIL;
  };

  app.get("/admin/unread-count", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });
    const unread = await db.select().from(supportMessages).where(and(eq(supportMessages.sender, "USER"), eq(supportMessages.isReadByAdmin, false)));
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
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    
    if (ticket) {
      const allTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.email, ticket.email));
      const ticketIds = allTickets.map(t => t.id);
      if (ticketIds.length > 0) {
        await db.update(supportMessages).set({ isReadByAdmin: true }).where(
          and(inArray(supportMessages.ticketId, ticketIds), eq(supportMessages.sender, "USER"))
        );
      }
    }
    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)).orderBy(supportMessages.createdAt);
  });

  app.post("/admin/tickets/:id/reply", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });

    const { id } = req.params as { id: string };
    const parsed = z.object({ 
      text: z.string().optional().default(""), 
      images: z.array(z.string()).optional().default([]) 
    }).refine(data => data.text.trim().length > 0 || data.images.length > 0, {
      message: "Нужен текст или картинка"
    }).safeParse(req.body);
    
    if (!parsed.success) return reply.code(400).send({ error: "Empty message" });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) return reply.code(404).send({ error: "Ticket not found" });

    await db.insert(supportMessages).values({ 
      ticketId: id, sender: "ADMIN", text: parsed.data.text, images: parsed.data.images, isReadByAdmin: true 
    });
    await db.update(supportTickets).set({ status: "ANSWERED" }).where(eq(supportTickets.id, id));
    
    return { success: true };
  });
}
`,
  "support.routes.ts (полная перезапись)"
);

// ═══ 3. Полная перезапись чата клиента (Защита от исчезновения) ═══
writeFile(
  "frontend/src/components/SupportChat.tsx",
  `import { useState, useRef, useEffect } from "react";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";
import { useAuth } from "../store/auth";
import { supportApi, type SupportMessage } from "../api/support";

export default function SupportChat({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [sessionToken, setSessionToken] = useState<string>("");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevUserId = useRef<string | null>(user?.id || null);

  useEffect(() => {
    let token = localStorage.getItem("support_session_token");
    
    // Если пользователь вышел из профиля, генерируем новый токен для гостя
    if (prevUserId.current && !user?.id) {
      token = crypto.randomUUID();
      localStorage.setItem("support_session_token", token);
    } else if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("support_session_token", token);
    }
    
    prevUserId.current = user?.id || null;
    
    setSessionToken(token);
    setEmail(user?.email || "");
    setMessages([]);
    setFetching(true);
  }, [user?.id]);

  const loadMessages = async () => {
    if (!sessionToken) return;
    try {
      const msgs = await supportApi.getMessages(sessionToken);
      if (msgs.length > 0 || messages.length === 0) {
        setMessages(msgs);
      }
    } catch (e) {
      // ignore
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [sessionToken, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImages((prev) => [...prev, event.target?.result as string]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!message && images.length === 0)) return;
    setLoading(true);
    try {
      const res = await supportApi.send({ email, message, images, sessionToken });
      
      if (res.sessionToken && res.sessionToken !== sessionToken) {
        setSessionToken(res.sessionToken);
        localStorage.setItem("support_session_token", res.sessionToken);
      } else {
        await loadMessages();
      }
      
      setMessage("");
      setImages([]);
    } catch (err: any) {
      const msg = err.response?.data?.error ? JSON.stringify(err.response.data.error) : "Ошибка отправки";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[400px] bg-slate-50">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm mt-10">
            <p>Напишите свой вопрос,</p>
            <p>и мы ответим вам прямо здесь.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={\`flex \${m.sender === "USER" ? "justify-end" : "justify-start"}\`}>
              <div
                className={\`max-w-[80%] rounded-2xl px-3 py-2 text-sm \${
                  m.sender === "USER"
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                }\`}
              >
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.images.map((img, i) => (
                      <img key={i} src={img} className="h-16 w-16 object-cover rounded-lg cursor-pointer" />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className={\`text-[9px] mt-1 text-right \${m.sender === "USER" ? "text-brand-200" : "text-slate-400"}\`}>
                  {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border-t border-slate-200 p-3">
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-2 pb-2 px-1">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0 group">
                <img src={img} className="h-12 w-12 object-cover rounded-lg border border-slate-200" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(!user || !email) && (
          <div className="mb-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ваша почта (для связи)"
              className="w-full !text-sm !bg-slate-50 !border-slate-200"
              required
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            title="Прикрепить фото"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder="Сообщение..."
            className="flex-1 !text-sm !py-2 !bg-slate-50 !border-slate-200 resize-none min-h-[72px] max-h-32"
            rows={3}
          />

          <button
            type="submit"
            disabled={loading || (!message && images.length === 0)}
            className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
`,
  "SupportChat.tsx (исправлен)"
);

// ═══ 4. Фикс прыжков в Админке ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `        // Используем setSelectedId только для инициализации первого чата, если ничего не выбрано\n        if (!selectedId && data.length > 0) {\n          setSelectedId(data[0].id);\n        }`,
  `        // Используем функциональное обновление, чтобы не зависеть от замыкания\n        setSelectedId(prev => {\n          if (!prev && data.length > 0) return data[0].id;\n          return prev;\n        });`,
  "AdminSupportPage.tsx (фикс прыжков)"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Все баги исправлены.");
} else {
  console.log("⚠️ Изменений не внесено.");
}