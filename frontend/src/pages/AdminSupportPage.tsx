import { useState, useEffect, useRef } from "react";
import { useAuth } from "../store/auth";
import { supportApi, type AdminTicket, type SupportMessage } from "../api/support";
import { Send, Loader2, Inbox, User } from "lucide-react";
import NavBar from "../components/NavBar";

const TARIFF_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business"
};

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
        
        {/* Список чатов */}
        <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-900">
            Все обращения ({tickets.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedId === t.id ? "bg-brand-50" : ""}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-sm text-slate-900 truncate pr-2">{t.email}</div>
                  {t.hasUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" title="Новое сообщение" />
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 mb-2">
                  {t.isRegistered ? (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      t.tariffId === "business" ? "bg-violet-100 text-violet-700" :
                      t.tariffId === "pro" ? "bg-brand-100 text-brand-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      Зареген · {TARIFF_LABELS[t.tariffId || "free"] || "Free"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                      Гость
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 truncate">{t.lastMessage}</div>
                <div className="text-[10px] text-slate-400 mt-2">{new Date(t.createdAt).toLocaleString("ru-RU")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Окно чата */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {selectedId ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900">{tickets.find(t => t.id === selectedId)?.email}</span>
                {tickets.find(t => t.id === selectedId)?.isRegistered && (
                  <span className="text-xs text-slate-500">(Зарегистрирован)</span>
                )}
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === "ADMIN" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${m.sender === "ADMIN" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div className={`text-[9px] mt-1 text-right ${m.sender === "ADMIN" ? "text-brand-200" : "text-slate-400"}`}>
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
