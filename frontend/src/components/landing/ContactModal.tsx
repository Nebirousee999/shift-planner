import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { trackEvent } from "../../lib/metrika";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, source: "pricing_business" }),
      });
      if (!res.ok) throw new Error();
      trackEvent("pricing_business_lead");
      setSent(true);
    } catch {
      setError("Не удалось отправить заявку. Напишите нам напрямую: prihodko999@inbox.ru");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Связаться по поводу Business</h3>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-medium text-slate-900">Заявка отправлена!</p>
            <p className="text-sm text-slate-500 mt-1">Мы свяжемся с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">Оставьте контакты, и мы настроим тариф под ваши задачи (несколько точек, интеграция с 1С и т.д.).</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              required
              maxLength={100}
              className="!text-sm"
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Телефон или Telegram"
              required
              maxLength={200}
              className="!text-sm"
            />
            {error && <p className="text-rose-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-medium hover:bg-brand-700 transition-colors flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отправить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
