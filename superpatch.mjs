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

function createFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Создан/Обновлён");
}

// ═══ 1. Миграция БД (добавляем сессии и историю сообщений) ═══
const migrationPath = path.join(ROOT, "db/migrations/0025_support_chat.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "session_token" varchar(255) UNIQUE;

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "sender" varchar(20) NOT NULL,
  "text" text NOT NULL,
  "images" text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
  `);
  touched++;
  console.log("✅ [0025_support_chat.sql] Создана миграция");
}

// ═══ 2. Схема Drizzle ═══
patchFile(
  "db/schema.ts",
  `  message: text("message").notNull(),\n  images: text("images").array(),\n  reply: text("reply"),`,
  `  sessionToken: varchar("session_token", { length: 255 }).unique(),`,
  "schema.ts (обновление support_tickets)"
);

patchFile(
  "db/schema.ts",
  `  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n});\n\nexport const payments = pgTable("payments", {`,
  `  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n});\n\nexport const supportMessages = pgTable("support_messages", {\n  id: uuid("id").primaryKey().defaultRandom(),\n  ticketId: uuid("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }).notNull(),\n  sender: varchar("sender", { length: 20 }).notNull(),\n  text: text("text").notNull(),\n  images: text("images").array(),\n  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),\n});\n\nexport const payments = pgTable("payments", {`,
  "schema.ts (добавление support_messages)"
);

// ═══ 3. Бэкенд API ═══
createFile(
  "src/modules/support/support.routes.ts",
  `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { supportTickets, supportMessages } from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import axios from "axios";

export async function supportRoutes(app: FastifyInstance) {
  // Отправка нового сообщения (создает тикет, если его нет)
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

    // Ищем существующий тикет по сессии
    let [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.sessionToken, sessionToken));

    if (!ticket) {
      [ticket] = await db
        .insert(supportTickets)
        .values({
          userId,
          email: parsed.data.email,
          sessionToken,
          status: "OPEN",
        })
        .returning();
    }

    // Сохраняем сообщение
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "USER",
      text: parsed.data.message,
      images: parsed.data.images,
    });

    const shortId = ticket.id.slice(0, 6).toUpperCase();

    // Уведомляем админа на почту
    await mailerService
      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId, parsed.data.images)
      .catch((e) => app.log.error(e));

    // Уведомляем админа в MAX
    try {
      const SUPPORT_BOT_TOKEN = process.env.SUPPORT_BOT_TOKEN;
      const SUPPORT_ADMIN_ID = process.env.SUPPORT_ADMIN_ID || "141744495";
      if (SUPPORT_BOT_TOKEN) {
        await axios.post(
          \`https://botapi.max.ru/messages?user_id=\${SUPPORT_ADMIN_ID}\`,
          {
            text: "📩 Чат поддержки #" + shortId + "\\nОт: " + parsed.data.email + "\\n\\n" + parsed.data.message + "\\n\\nЧтобы ответить, напишите:\\n#" + shortId + " ваш ответ",
          },
          { headers: { Authorization: SUPPORT_BOT_TOKEN } }
        );
      }
    } catch (e: any) {
      app.log.warn({ err: e?.message }, "MAX send failed");
    }

    return { success: true, ticketId: shortId, sessionToken };
  });

  // Получение истории сообщений
  app.get("/messages", async (req) => {
    const { sessionToken } = req.query as { sessionToken?: string };
    if (!sessionToken) return [];

    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.sessionToken, sessionToken));

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

// ═══ 4. Webhook (Ответ админа из MAX попадает в чат) ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `        if (ticket) {\n          await db\n            .update(supportTickets)\n            .set({ reply: replyText, status: "ANSWERED" })\n            .where(eq(supportTickets.id, ticket.id));`,
  `        if (ticket) {\n          // Записываем ответ в историю чата\n          await db.insert(supportMessages).values({\n            ticketId: ticket.id,\n            sender: "ADMIN",\n            text: replyText,\n          });\n\n          await db\n            .update(supportTickets)\n            .set({ status: "ANSWERED" })\n            .where(eq(supportTickets.id, ticket.id));`,
  "webhooks.routes.ts (сохранение ответа в историю)"
);

// Добавляем импорт supportMessages в webhook
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `import { payments, organizations, supportTickets } from "../../../db/schema.js";`,
  `import { payments, organizations, supportTickets, supportMessages } from "../../../db/schema.js";`,
  "webhooks.routes.ts (импорт supportMessages)"
);

// ═══ 5. Фронтенд API ═══
createFile(
  "frontend/src/api/support.ts",
  `import { api } from "./client";

export type SupportMessage = {
  id: string;
  sender: "USER" | "ADMIN";
  text: string;
  images: string[] | null;
  createdAt: string;
};

export const supportApi = {
  send: async (data: { email: string; message: string; images?: string[]; sessionToken?: string }) => {
    const { data: res } = await api.post("/support", data);
    return res;
  },
  getMessages: async (sessionToken: string): Promise<SupportMessage[]> => {
    if (!sessionToken) return [];
    const { data } = await api.get<SupportMessage[]>("/support/messages", {
      params: { sessionToken },
    });
    return data;
  },
};
`,
  "frontend/src/api/support.ts"
);

// ═══ 6. Компонент чата (Общий для виджета и контактов) ═══
createFile(
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

  // Инициализация сессии
  useEffect(() => {
    let token = localStorage.getItem("support_session_token");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("support_session_token", token);
    }
    setSessionToken(token);
  }, []);

  // Загрузка истории и поллинг
  const loadMessages = async () => {
    if (!sessionToken) return;
    try {
      const msgs = await supportApi.getMessages(sessionToken);
      setMessages(msgs);
    } catch (e) {
      // ignore
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000); // Опрос каждые 5 сек
    return () => clearInterval(interval);
  }, [sessionToken]);

  // Прокрутка вниз при новом сообщении
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
      setMessage("");
      setImages([]);
      await loadMessages();
    } catch (err) {
      alert("Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[400px] bg-slate-50">
      {/* Сообщения */}
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

      {/* Форма ввода */}
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

        {messages.length === 0 && (
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
            placeholder="Сообщение... (можно вставить фото из буфера)"
            className="flex-1 !text-sm !py-2 !bg-slate-50 !border-slate-200 resize-none max-h-24"
            rows={1}
            required={images.length === 0}
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
  "frontend/src/components/SupportChat.tsx"
);

// ═══ 7. Виджет (Использует SupportChat) ═══
createFile(
  "frontend/src/components/SupportWidget.tsx",
  `import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "../store/auth";
import SupportChat from "./SupportChat";

export default function SupportWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Сотрудники не видят эту форму
  if (user?.role === "EMPLOYEE") return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 sm:w-96 mb-4 overflow-hidden animate-fade-in flex flex-col">
          <div className="bg-brand-600 text-white p-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-sm">Чат с поддержкой</h3>
              <p className="text-brand-100 text-[10px]">Ответим на почту или в MAX</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <SupportChat />
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-brand-600 text-white rounded-full shadow-xl hover:bg-brand-700 transition-all flex items-center justify-center hover:scale-105"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
`,
  "frontend/src/components/SupportWidget.tsx"
);

// ═══ 8. Страница Контактов (Встраивает тот же чат) ═══
createFile(
  "frontend/src/pages/ContactsPage.tsx",
  `import PublicPageLayout from "../components/landing/PublicPageLayout";
import { useAuth } from "../store/auth";
import SupportChat from "../components/SupportChat";

export default function ContactsPage() {
  const { user } = useAuth();

  return (
    <PublicPageLayout title="Контакты">
      {user?.role === "EMPLOYEE" ? (
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Доступ ограничен</h3>
          <p className="text-slate-500">Если у вас есть вопросы, обратитесь к вашему руководителю.</p>
        </div>
      ) : user?.role === "OWNER" || user?.role === "MANAGER" ? (
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Вы авторизованы</h3>
          <p className="text-slate-500">Пожалуйста, используйте виджет поддержки в правом нижнем углу экрана.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden not-prose shadow-sm max-w-lg mx-auto">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Напишите нам</h3>
            <p className="text-xs text-slate-500">Мы ответим вам прямо здесь</p>
          </div>
          <SupportChat />
        </div>
      )}
    </PublicPageLayout>
  );
}
`,
  "frontend/src/pages/ContactsPage.tsx"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}