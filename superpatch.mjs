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

// ═══ 1. Бэкенд: Счетчики непрочитанных ═══
// Добавляем эндпоинт для общего счетчика
patchFile(
  "src/modules/support/support.routes.ts",
  `  app.get("/admin/tickets", async (req, reply) => {`,
  `  app.get("/admin/unread-count", async (req, reply) => {
    const userId = (req as any).user?.sub;
    if (!(await checkAdmin(userId))) return reply.code(403).send({ error: "Forbidden" });
    
    const unread = await db.select().from(supportMessages).where(
      and(eq(supportMessages.sender, "USER"), eq(supportMessages.isReadByAdmin, false))
    );
    return { count: unread.length };
  });

  app.get("/admin/tickets", async (req, reply) => {`,
  "support.routes.ts (эндпоинт unread-count)"
);

// Добавляем подсчет непрочитанных для каждого тикета
patchFile(
  "src/modules/support/support.routes.ts",
  `    const uniqueTickets = new Map();\n    for (const t of tickets) {\n      if (!uniqueTickets.has(t.email)) {\n        const lastMsg = allMessages.find(m => m.ticketId === t.id);\n        const hasUnread = allMessages.some(m => m.ticketId === t.id && m.sender === "USER" && !m.isReadByAdmin);`,
  `    const unreadCounts = new Map();\n    for (const m of allMessages) {\n      if (m.sender === "USER" && !m.isReadByAdmin) {\n        unreadCounts.set(m.ticketId, (unreadCounts.get(m.ticketId) || 0) + 1);\n      }\n    }\n\n    const uniqueTickets = new Map();\n    for (const t of tickets) {\n      if (!uniqueTickets.has(t.email)) {\n        const lastMsg = allMessages.find(m => m.ticketId === t.id);\n        const unreadCount = unreadCounts.get(t.id) || 0;`,
  "support.routes.ts (подсчет для тикетов 1)"
);

patchFile(
  "src/modules/support/support.routes.ts",
  `          lastMessage: lastMsg?.text || t.message || "...",\n          hasUnread,`,
  `          lastMessage: lastMsg?.text || t.message || "...",\n          unreadCount,`,
  "support.routes.ts (подсчет для тикетов 2)"
);

// ═══ 2. Фронтенд API ═══
patchFile(
  "frontend/src/api/support.ts",
  `  lastMessage: string;\n  hasUnread: boolean;`,
  `  lastMessage: string;\n  unreadCount: number;`,
  "support.ts (тип AdminTicket)"
);

patchFile(
  "frontend/src/api/support.ts",
  `  adminGetTickets: async (): Promise<AdminTicket[]> => {`,
  `  adminGetUnreadCount: async (): Promise<number> => {\n    try {\n      const { data } = await api.get<{ count: number }>("/support/admin/unread-count");\n      return data.count;\n    } catch { return 0; }\n  },\n  adminGetTickets: async (): Promise<AdminTicket[]> => {`,
  "support.ts (метод adminGetUnreadCount)"
);

// ═══ 3. NavBar: Общий бейдж ═══
patchFile(
  "frontend/src/components/NavBar.tsx",
  `import { useOrganization } from "../store/organization";`,
  `import { useOrganization } from "../store/organization";\nimport { supportApi } from "../api/support";\nimport { useState } from "react";`,
  "NavBar.tsx (импорты)"
);

patchFile(
  "frontend/src/components/NavBar.tsx",
  `  const org = useOrganization((s) => s.org);`,
  `  const org = useOrganization((s) => s.org);\n  const [supportUnread, setSupportUnread] = useState(0);\n\n  useEffect(() => {\n    if (user?.email !== "prihodko999@inbox.ru") return;\n    supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});\n    const interval = setInterval(() => {\n      supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});\n    }, 10000);\n    return () => clearInterval(interval);\n  }, [user?.email]);`,
  "NavBar.tsx (логика счетчика)"
);

// Заменяем кнопку в сотрудническом виде
patchFile(
  "frontend/src/components/NavBar.tsx",
  `            {user?.email === "prihodko999@inbox.ru" && (\n              <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">\n                <MessageSquare className="w-4 h-4" />\n              </button>\n            )}`,
  `            {user?.email === "prihodko999@inbox.ru" && (\n              <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">\n                <MessageSquare className="w-4 h-4" />\n                <Badge value={supportUnread} />\n              </button>\n            )}`,
  "NavBar.tsx (кнопка в сотрудническом виде)"
);

// Заменяем кнопку в админском виде
patchFile(
  "frontend/src/components/NavBar.tsx",
  `          {user?.email === "prihodko999@inbox.ru" && (\n            <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">\n              <MessageSquare className="w-4 h-4" />\n            </button>\n          )}`,
  `          {user?.email === "prihodko999@inbox.ru" && (\n            <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">\n              <MessageSquare className="w-4 h-4" />\n              <Badge value={supportUnread} />\n            </button>\n          )}`,
  "NavBar.tsx (кнопка в админском виде)"
);

// ═══ 4. AdminSupportPage: Количество сообщений в списке чатов ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `                <div className="flex justify-between items-start mb-1">\n                  <div className="font-semibold text-sm text-slate-900 truncate pr-2">{t.email}</div>\n                  {t.hasUnread && (\n                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" title="Новое сообщение" />\n                  )}\n                </div>`,
  `                <div className="flex justify-between items-start mb-1">\n                  <div className="font-semibold text-sm text-slate-900 truncate pr-2">{t.email}</div>\n                  {t.unreadCount > 0 && (\n                    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0" title="Новых сообщений">\n                      {t.unreadCount}\n                    </span>\n                  )}\n                </div>`,
  "AdminSupportPage.tsx (цифра вместо точки)"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Счетчики непрочитанных добавлены в меню и список чатов.");
} else {
  console.log("⚠️ Изменений не внесено.");
}