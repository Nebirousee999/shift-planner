import { useState, useEffect } from "react";
import PublicPageLayout from "../components/landing/PublicPageLayout";
import { Send, CheckCircle2, MessageSquare, Clock } from "lucide-react";
import { useAuth } from "../store/auth";
import { supportApi, type Ticket } from "../api/support";
import { meApi } from "../api/me";

export default function ContactsPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sent, setSent] = useState(false);

  const loadTickets = () => {
    if (user) supportApi.my().then(setTickets).catch(() => {});
  };

  useEffect(() => {
    if (user) {
      meApi.profile().then((p) => setEmail(p.email)).catch(() => {});
      loadTickets();
      const interval = setInterval(loadTickets, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;
    setLoading(true);
    try {
      await supportApi.create({ email, message });
      setMessage("");
      setSent(true);
      loadTickets();
      setTimeout(() => setSent(false), 4000);
    } catch {
      alert("Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicPageLayout title="Контакты">
      <p className="mb-6">
        Задайте вопрос, и мы ответим вам на почту (или в MAX, если он привязан к профилю).
      </p>

      {sent && (
        <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> Вопрос отправлен! Мы скоро свяжемся с вами.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mb-10">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ваша почта</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full" placeholder="ivan@mail.ru" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Вопрос</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="w-full" placeholder="Опишите вашу проблему или задайте вопрос..." />
        </div>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors">
          <Send className="w-4 h-4" /> {loading ? "Отправка..." : "Отправить"}
        </button>
      </form>

      {user && tickets.length > 0 && (
        <div className="border-t border-slate-200 pt-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-600" /> Ваши обращения
          </h3>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-slate-900">{t.message}</div>
                  <span className={"text-[10px] px-2 py-0.5 rounded-full font-semibold " + (t.status === "ANSWERED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {t.status === "ANSWERED" ? "Есть ответ" : "В обработке"}
                  </span>
                </div>
                {t.reply ? (
                  <div className="mt-3 bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-800">
                    <span className="font-semibold text-brand-600 block mb-1">Ответ поддержки:</span>
                    {t.reply}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Ожидайте ответа...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PublicPageLayout>
  );
}
