// superpatch.mjs — система поддержки (тикеты) с MAX и email
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.log("⚠️  [" + label + "] Файл не найден: " + relPath);
    return;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log("⏭  [" + label + "] Уже применено");
    return;
  }
  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("❌ [" + label + "] Не найдено совпадение");
  }
}

function createFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (existing === content) {
      console.log("⏭  [" + label + "] Уже существует с тем же содержимым");
      return;
    }
  }
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Создан файл");
}

// ═══ 1. Схема БД ═══
patchFile(
  "db/schema.ts",
  "export const payments = pgTable(\"payments\", {",
  "export const supportTickets = pgTable(\"support_tickets\", {\n" +
  "  id: uuid(\"id\").primaryKey().defaultRandom(),\n" +
  "  userId: uuid(\"user_id\").references(() => users.id),\n" +
  "  email: varchar(\"email\", { length: 255 }).notNull(),\n" +
  "  message: text(\"message\").notNull(),\n" +
  "  reply: text(\"reply\"),\n" +
  "  status: varchar(\"status\", { length: 20 }).default(\"OPEN\").notNull(),\n" +
  "  createdAt: timestamp(\"created_at\", { withTimezone: true }).defaultNow().notNull(),\n" +
  "});\n\n" +
  "export const payments = pgTable(\"payments\", {",
  "db/schema.ts (таблица support_tickets)"
);

// ═══ 2. Миграция ═══
const migrationPath = path.join(ROOT, "db/migrations/0023_support_tickets.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(
    migrationPath,
    "CREATE TABLE \"support_tickets\" (\n" +
    "  \"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n" +
    "  \"user_id\" uuid,\n" +
    "  \"email\" varchar(255) NOT NULL,\n" +
    "  \"message\" text NOT NULL,\n" +
    "  \"reply\" text,\n" +
    "  \"status\" varchar(20) DEFAULT 'OPEN' NOT NULL,\n" +
    "  \"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n" +
    ");\n" +
    "ALTER TABLE \"support_tickets\" ADD CONSTRAINT \"support_tickets_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;"
  );
  touched++;
  console.log("✅ [db/migrations/0023_support_tickets.sql] Создан файл");
} else {
  console.log("⏭  [db/migrations/0023_support_tickets.sql] Уже существует");
}

// ═══ 3. mailer.service.ts — два новых метода ═══
patchFile(
  "src/lib/mailer.service.ts",
  "  async sendBotLinkEmail(to: string, name: string, link: string) {",
  "  async sendSupportEmail(fromEmail: string, message: string, shortId: string) {\n" +
  "    await transporter.sendMail({\n" +
  "      from: `\"Поддержка\" <help@shift-planner.ru>`,\n" +
  "      to: \"prihodko999@inbox.ru\",\n" +
  "      replyTo: fromEmail,\n" +
  "      subject: `Обращение в поддержку #${shortId}`,\n" +
  "      html: `<p>От: ${fromEmail}</p><p>${message}</p>`\n" +
  "    });\n" +
  "  },\n\n" +
  "  async sendSupportReply(to: string, message: string) {\n" +
  "    await transporter.sendMail({\n" +
  "      from: `\"Поддержка\" <help@shift-planner.ru>`,\n" +
  "      to,\n" +
  "      subject: `Ответ службы поддержки`,\n" +
  "      html: `<p>${message}</p>`\n" +
  "    });\n" +
  "  },\n\n" +
  "  async sendBotLinkEmail(to: string, name: string, link: string) {",
  "mailer.service.ts (методы поддержки)"
);

// ═══ 4. support.routes.ts — новый файл ═══
createFile(
  "src/modules/support/support.routes.ts",
  "import type { FastifyInstance } from \"fastify\";\n" +
  "import { z } from \"zod\";\n" +
  "import { eq, desc } from \"drizzle-orm\";\n" +
  "import { db } from \"../../../db/client.js\";\n" +
  "import { supportTickets, organizations } from \"../../../db/schema.js\";\n" +
  "import { mailerService } from \"../../lib/mailer.service.js\";\n" +
  "import axios from \"axios\";\n\n" +
  "export async function supportRoutes(app: FastifyInstance) {\n" +
  "  app.post(\"/\", async (req, reply) => {\n" +
  "    const parsed = z.object({\n" +
  "      email: z.string().email(),\n" +
  "      message: z.string().min(1),\n" +
  "    }).safeParse(req.body);\n\n" +
  "    if (!parsed.success) {\n" +
  "      return reply.code(400).send({ error: parsed.error.flatten() });\n" +
  "    }\n\n" +
  "    const userId = (req as any).user?.sub || null;\n" +
  "    const [ticket] = await db\n" +
  "      .insert(supportTickets)\n" +
  "      .values({ userId, email: parsed.data.email, message: parsed.data.message })\n" +
  "      .returning();\n" +
  "    const shortId = ticket.id.slice(0, 6).toUpperCase();\n\n" +
  "    await mailerService\n" +
  "      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId)\n" +
  "      .catch((e) => app.log.error(e));\n\n" +
  "    try {\n" +
  "      const [org] = await db.select().from(organizations).limit(1);\n" +
  "      if (org?.maxBotToken) {\n" +
  "        await axios.post(\n" +
  "          \"https://botapi.max.ru/messages?user_id=141744495\",\n" +
  "          {\n" +
  "            text:\n" +
  "              \"📩 Обращение #\" + shortId + \"\\n\" +\n" +
  "              \"От: \" + parsed.data.email + \"\\n\\n\" +\n" +
  "              parsed.data.message + \"\\n\\n\" +\n" +
  "              \"Чтобы ответить, напишите:\\n#\" + shortId + \" ваш ответ\",\n" +
  "          },\n" +
  "          { headers: { Authorization: org.maxBotToken } }\n" +
  "        );\n" +
  "      }\n" +
  "    } catch (e: any) {\n" +
  "      app.log.warn({ err: e?.message }, \"MAX send failed\");\n" +
  "    }\n\n" +
  "    return { success: true, ticketId: shortId };\n" +
  "  });\n\n" +
  "  app.get(\"/my\", async (req) => {\n" +
  "    const userId = (req as any).user?.sub;\n" +
  "    if (!userId) return [];\n" +
  "    return db\n" +
  "      .select()\n" +
  "      .from(supportTickets)\n" +
  "      .where(eq(supportTickets.userId, userId))\n" +
  "      .orderBy(desc(supportTickets.createdAt));\n" +
  "  });\n" +
  "}\n",
  "src/modules/support/support.routes.ts"
);

// ═══ 5. server.ts — импорт и регистрация ═══
patchFile(
  "src/server.ts",
  "import { notificationsRoutes } from \"./modules/notifications/notifications.routes.js\";",
  "import { notificationsRoutes } from \"./modules/notifications/notifications.routes.js\";\n" +
  "import { supportRoutes } from \"./modules/support/support.routes.js\";",
  "server.ts (импорт supportRoutes)"
);

patchFile(
  "src/server.ts",
  "await app.register(notificationsRoutes, { prefix: \"/api/notifications\" });",
  "await app.register(notificationsRoutes, { prefix: \"/api/notifications\" });\n" +
  "await app.register(supportRoutes, { prefix: \"/api/support\" });",
  "server.ts (регистрация supportRoutes)"
);

// ═══ 6. webhooks.routes.ts — импорты ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  "import { payments, organizations } from \"../../../db/schema.js\";",
  "import { payments, organizations, supportTickets } from \"../../../db/schema.js\";",
  "webhooks.routes.ts (импорт supportTickets)"
);

patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  "import { yookassaService } from \"../../lib/yookassa.js\";",
  "import { yookassaService } from \"../../lib/yookassa.js\";\n" +
  "import { mailerService } from \"../../lib/mailer.service.js\";",
  "webhooks.routes.ts (импорт mailerService)"
);

// ═══ 7. webhooks.routes.ts — обработка ответа админа ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  "          const ADMIN_ID = \"141744495\"; // Твой личный ID в MAX",
  "          const ADMIN_ID = \"141744495\"; // Твой личный ID в MAX\n\n" +
  "          // Ответ на тикет: формат \"#SHORTID текст\"\n" +
  "          if (senderId === ADMIN_ID && text.startsWith(\"#\")) {\n" +
  "            const spaceIdx = text.indexOf(\" \");\n" +
  "            const shortId = text.substring(1, spaceIdx > -1 ? spaceIdx : text.length).toUpperCase();\n" +
  "            const replyText = spaceIdx > -1 ? text.substring(spaceIdx + 1) : \"\";\n" +
  "            const tickets = await db.select().from(supportTickets);\n" +
  "            const ticket = tickets.find((t) => t.id.slice(0, 6).toUpperCase() === shortId);\n" +
  "            if (ticket) {\n" +
  "              await db\n" +
  "                .update(supportTickets)\n" +
  "                .set({ reply: replyText, status: \"ANSWERED\" })\n" +
  "                .where(eq(supportTickets.id, ticket.id));\n" +
  "              await mailerService.sendSupportReply(ticket.email, replyText).catch(() => {});\n" +
  "              if (ticket.userId) {\n" +
  "                await axios\n" +
  "                  .post(\n" +
  "                    \"https://botapi.max.ru/messages?user_id=\" + ticket.userId,\n" +
  "                    { text: \"Ответ поддержки:\\n\\n\" + replyText },\n" +
  "                    { headers: { Authorization: org.token } }\n" +
  "                  )\n" +
  "                  .catch(() => {});\n" +
  "              }\n" +
  "              await axios\n" +
  "                .post(\n" +
  "                  \"https://botapi.max.ru/messages?user_id=\" + ADMIN_ID,\n" +
  "                  { text: \"✅ Ответ на #\" + shortId + \" отправлен клиенту!\" },\n" +
  "                  { headers: { Authorization: org.token } }\n" +
  "                )\n" +
  "                .catch(() => {});\n" +
  "            }\n" +
  "            return reply.send({ ok: true });\n" +
  "          }",
  "webhooks.routes.ts (обработка ответа на тикет)"
);

// ═══ 8. Фронтенд API ═══
createFile(
  "frontend/src/api/support.ts",
  "import { api } from \"./client\";\n\n" +
  "export type Ticket = {\n" +
  "  id: string;\n" +
  "  email: string;\n" +
  "  message: string;\n" +
  "  reply: string | null;\n" +
  "  status: string;\n" +
  "  createdAt: string;\n" +
  "};\n\n" +
  "export const supportApi = {\n" +
  "  create: async (data: { email: string; message: string }) => {\n" +
  "    const { data: res } = await api.post(\"/support\", data);\n" +
  "    return res;\n" +
  "  },\n" +
  "  my: async (): Promise<Ticket[]> => {\n" +
  "    const { data } = await api.get<Ticket[]>(\"/support/my\");\n" +
  "    return data;\n" +
  "  },\n" +
  "};\n",
  "frontend/src/api/support.ts"
);

// ═══ 9. Страница Контактов ═══
createFile(
  "frontend/src/pages/ContactsPage.tsx",
  "import { useState, useEffect } from \"react\";\n" +
  "import PublicPageLayout from \"../components/landing/PublicPageLayout\";\n" +
  "import { Send, CheckCircle2, MessageSquare, Clock } from \"lucide-react\";\n" +
  "import { useAuth } from \"../store/auth\";\n" +
  "import { supportApi, type Ticket } from \"../api/support\";\n" +
  "import { meApi } from \"../api/me\";\n\n" +
  "export default function ContactsPage() {\n" +
  "  const { user } = useAuth();\n" +
  "  const [email, setEmail] = useState(\"\");\n" +
  "  const [message, setMessage] = useState(\"\");\n" +
  "  const [loading, setLoading] = useState(false);\n" +
  "  const [tickets, setTickets] = useState<Ticket[]>([]);\n" +
  "  const [sent, setSent] = useState(false);\n\n" +
  "  const loadTickets = () => {\n" +
  "    if (user) supportApi.my().then(setTickets).catch(() => {});\n" +
  "  };\n\n" +
  "  useEffect(() => {\n" +
  "    if (user) {\n" +
  "      meApi.profile().then((p) => setEmail(p.email)).catch(() => {});\n" +
  "      loadTickets();\n" +
  "      const interval = setInterval(loadTickets, 15000);\n" +
  "      return () => clearInterval(interval);\n" +
  "    }\n" +
  "  }, [user]);\n\n" +
  "  const handleSubmit = async (e: React.FormEvent) => {\n" +
  "    e.preventDefault();\n" +
  "    if (!email || !message) return;\n" +
  "    setLoading(true);\n" +
  "    try {\n" +
  "      await supportApi.create({ email, message });\n" +
  "      setMessage(\"\");\n" +
  "      setSent(true);\n" +
  "      loadTickets();\n" +
  "      setTimeout(() => setSent(false), 4000);\n" +
  "    } catch {\n" +
  "      alert(\"Ошибка отправки\");\n" +
  "    } finally {\n" +
  "      setLoading(false);\n" +
  "    }\n" +
  "  };\n\n" +
  "  return (\n" +
  "    <PublicPageLayout title=\"Контакты\">\n" +
  "      <p className=\"mb-6\">\n" +
  "        Задайте вопрос, и мы ответим вам на почту (или в MAX, если он привязан к профилю).\n" +
  "      </p>\n\n" +
  "      {sent && (\n" +
  "        <div className=\"mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-2\">\n" +
  "          <CheckCircle2 className=\"w-5 h-5\" /> Вопрос отправлен! Мы скоро свяжемся с вами.\n" +
  "        </div>\n" +
  "      )}\n\n" +
  "      <form onSubmit={handleSubmit} className=\"space-y-4 mb-10\">\n" +
  "        <div>\n" +
  "          <label className=\"block text-sm font-medium text-slate-700 mb-1\">Ваша почта</label>\n" +
  "          <input type=\"email\" value={email} onChange={(e) => setEmail(e.target.value)} required className=\"w-full\" placeholder=\"ivan@mail.ru\" />\n" +
  "        </div>\n" +
  "        <div>\n" +
  "          <label className=\"block text-sm font-medium text-slate-700 mb-1\">Вопрос</label>\n" +
  "          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className=\"w-full\" placeholder=\"Опишите вашу проблему или задайте вопрос...\" />\n" +
  "        </div>\n" +
  "        <button type=\"submit\" disabled={loading} className=\"inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors\">\n" +
  "          <Send className=\"w-4 h-4\" /> {loading ? \"Отправка...\" : \"Отправить\"}\n" +
  "        </button>\n" +
  "      </form>\n\n" +
  "      {user && tickets.length > 0 && (\n" +
  "        <div className=\"border-t border-slate-200 pt-8\">\n" +
  "          <h3 className=\"text-lg font-bold text-slate-900 mb-4 flex items-center gap-2\">\n" +
  "            <MessageSquare className=\"w-5 h-5 text-brand-600\" /> Ваши обращения\n" +
  "          </h3>\n" +
  "          <div className=\"space-y-3\">\n" +
  "            {tickets.map((t) => (\n" +
  "              <div key={t.id} className=\"bg-slate-50 border border-slate-200 rounded-xl p-4\">\n" +
  "                <div className=\"flex justify-between items-start mb-2\">\n" +
  "                  <div className=\"font-medium text-slate-900\">{t.message}</div>\n" +
  "                  <span className={\"text-[10px] px-2 py-0.5 rounded-full font-semibold \" + (t.status === \"ANSWERED\" ? \"bg-emerald-100 text-emerald-700\" : \"bg-amber-100 text-amber-700\")}>\n" +
  "                    {t.status === \"ANSWERED\" ? \"Есть ответ\" : \"В обработке\"}\n" +
  "                  </span>\n" +
  "                </div>\n" +
  "                {t.reply ? (\n" +
  "                  <div className=\"mt-3 bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-800\">\n" +
  "                    <span className=\"font-semibold text-brand-600 block mb-1\">Ответ поддержки:</span>\n" +
  "                    {t.reply}\n" +
  "                  </div>\n" +
  "                ) : (\n" +
  "                  <div className=\"mt-2 text-xs text-slate-500 flex items-center gap-1\">\n" +
  "                    <Clock className=\"w-3 h-3\" /> Ожидайте ответа...\n" +
  "                  </div>\n" +
  "                )}\n" +
  "              </div>\n" +
  "            ))}\n" +
  "          </div>\n" +
  "        </div>\n" +
  "      )}\n" +
  "    </PublicPageLayout>\n" +
  "  );\n" +
  "}\n",
  "frontend/src/pages/ContactsPage.tsx"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}