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

// ═══ 1. API Клиент ═══
writeFile(
  "frontend/src/api/support.ts",
  `import { api } from "./client";

export type SupportMessage = {
  id: string;
  sender: "USER" | "ADMIN";
  text: string;
  images: string[] | null;
  createdAt: string;
};

export type AdminTicket = {
  id: string;
  email: string;
  userId: string | null;
  status: string;
  lastMessage: string;
  createdAt: string;
};

export const supportApi = {
  send: async (data: { email: string; message: string; images?: string[]; sessionToken?: string }) => {
    const { data: res } = await api.post("/support", data);
    return res;
  },
  getMessages: async (sessionToken: string): Promise<SupportMessage[]> => {
    if (!sessionToken) return [];
    const { data } = await api.get<SupportMessage[]>("/support/messages", { params: { sessionToken } });
    return data;
  },
  adminGetTickets: async (): Promise<AdminTicket[]> => {
    const { data } = await api.get<AdminTicket[]>("/support/admin/tickets");
    return data;
  },
  adminGetMessages: async (ticketId: string): Promise<SupportMessage[]> => {
    const { data } = await api.get<SupportMessage[]>(\`/support/admin/tickets/\${ticketId}/messages\`);
    return data;
  },
  adminReply: async (ticketId: string, text: string) => {
    const { data } = await api.post(\`/support/admin/tickets/\${ticketId}/reply\`, { text });
    return data;
  }
};
`,
  "frontend/src/api/support.ts"
);

// ═══ 2. Страница Админ-Панели ═══
writeFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `import { useState, useEffect, useRef } from "react";
import { useAuth } from "../store/auth";
import { supportApi, type AdminTicket, type SupportMessage } from "../api/support";
import { Send, Loader2, Inbox, User } from "lucide-react";
import NavBar from "../components/NavBar";

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadTickets = () => {
    supportApi.adminGetTickets()
      .then(data => {
        setTickets(data);
        if (!selectedId && data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadMessages = () => {
    if (!selectedId) return;
    supportApi.adminGetMessages(selectedId).then(setMessages).catch(() => {});
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      await supportApi.adminReply(selectedId, replyText);
      setReplyText("");
      await loadMessages();
      await loadTickets();
    } catch {
      alert("Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex gap-4 h-[calc(100vh-80px)]">
        
        <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-900">
            Все обращения ({tickets.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={\`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors \${selectedId === t.id ? "bg-brand-50" : ""}\`}
              >
                <div className="font-semibold text-sm text-slate-900 truncate">{t.email}</div>
                <div className="text-xs text-slate-500 truncate mt-1">{t.lastMessage}</div>
                <div className="text-[10px] text-slate-400 mt-2">{new Date(t.createdAt).toLocaleString("ru-RU")}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {selectedId ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900">{tickets.find(t => t.id === selectedId)?.email}</span>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map(m => (
                  <div key={m.id} className={\`flex \${m.sender === "ADMIN" ? "justify-end" : "justify-start"}\`}>
                    <div className={\`max-w-[70%] rounded-2xl px-4 py-2 text-sm \${m.sender === "ADMIN" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}\`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div className={\`text-[9px] mt-1 text-right \${m.sender === "ADMIN" ? "text-brand-200" : "text-slate-400"}\`}>
                        {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Написать ответ клиенту..."
                  className="flex-1 !text-sm !py-2 !bg-slate-50 resize-none min-h-[40px] max-h-32"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReply(e);
                    }
                  }}
                />
                <button type="submit" disabled={sending || !replyText.trim()} className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Inbox className="w-12 h-12 mb-2 opacity-50" />
              <p>Выберите чат для общения</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
`,
  "frontend/src/pages/AdminSupportPage.tsx"
);

// ═══ 3. Роутинг (App.tsx) ═══
let appContent = fs.readFileSync(path.join(ROOT, "frontend/src/App.tsx"), "utf-8");
if (!appContent.includes("AdminSupportPage")) {
  appContent = appContent.replace(
    `const LandingPage = lazy(() => import("./pages/LandingPage"));`,
    `const LandingPage = lazy(() => import("./pages/LandingPage"));\nconst AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));`
  );
  appContent = appContent.replace(
    `<Route path="/history" element={<ProtectedRoute adminOnly><HistoryPage /></ProtectedRoute>} />`,
    `<Route path="/history" element={<ProtectedRoute adminOnly><HistoryPage /></ProtectedRoute>} />\n          <Route path="/admin-support" element={<ProtectedRoute><AdminSupportPage /></ProtectedRoute>} />`
  );
  fs.writeFileSync(path.join(ROOT, "frontend/src/App.tsx"), appContent, "utf-8");
  touched++;
  console.log("✅ [App.tsx] Добавлен роут /admin-support");
}

// ═══ 4. Кнопка в меню (NavBar.tsx) ═══
let navContent = fs.readFileSync(path.join(ROOT, "frontend/src/components/NavBar.tsx"), "utf-8");
if (!navContent.includes("admin-support")) {
  const button = `
          {user?.email === "prihodko999@inbox.ru" && (
            <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
  `;
  
  navContent = navContent.replace(
    `<button onClick={() => navigate("/help")} className={\`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors \${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}\`} title="Справка">`,
    button + `\n<button onClick={() => navigate("/help")} className={\`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors \${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}\`} title="Справка">`
  );
  
  navContent = navContent.replace(
    `<button onClick={() => navigate("/help")} className={\`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors \${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}\`} title="Справка">`,
    button + `\n<button onClick={() => navigate("/help")} className={\`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors \${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}\`} title="Справка">`
  );
  
  if (!navContent.includes("MessageSquare")) {
    navContent = navContent.replace("HelpCircle, AlertCircle, Wallet,", "HelpCircle, AlertCircle, Wallet, MessageSquare,");
  }
  
  fs.writeFileSync(path.join(ROOT, "frontend/src/components/NavBar.tsx"), navContent, "utf-8");
  touched++;
  console.log("✅ [NavBar.tsx] Добавлена кнопка панели");
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Интерфейс панели добавлен.");
} else {
  console.log("⚠️ Изменений не внесено.");
}