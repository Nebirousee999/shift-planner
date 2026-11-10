import PublicPageLayout from "../components/landing/PublicPageLayout";
import { Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../store/auth";
import { supportApi } from "../api/support";

export default function ContactsPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;
    setLoading(true);
    try {
      await supportApi.create({ email, message });
      setSent(true);
      setMessage("");
    } catch (err) {
      alert("Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

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
        <>
          <p className="mb-6 text-slate-600">Задайте вопрос, и мы ответим вам на почту.</p>
          {sent && (
            <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Вопрос отправлен! Мы скоро свяжемся с вами.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
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
        </>
      )}
    </PublicPageLayout>
  );
}
