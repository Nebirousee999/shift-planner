import { useState, useEffect } from "react";
import { Cookie } from "lucide-react";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      // Показываем баннер с задержкой 1 сек, чтобы не мешать загрузке
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  const handleAccept = () => {
    localStorage.setItem("cookie_consent", "true");
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-[90] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
          <Cookie className="w-4 h-4 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 leading-snug mb-3">
            Мы используем файлы cookie, чтобы сайт работал лучше. Продолжая, вы соглашаетесь с{" "}
            <a href="/privacy" className="text-brand-600 hover:underline">политикой конфиденциальности</a>.
          </p>
          <div className="flex gap-2">
            <button onClick={handleAccept} className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors">
              Принять
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}