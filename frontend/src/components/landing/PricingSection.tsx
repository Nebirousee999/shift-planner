import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import ContactModal from "./ContactModal";
// import { trackEvent } from "../../lib/metrika"; // Раскомментируй, если используешь Метрику

type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  monthly: number;
  yearly: number;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    description: "Попробовать и вести небольшую команду",
    features: [
      "3 сотрудника",
      "1 точка",
      "Базовое расписание смен",
      "Импорт из Excel",
      "Экспорт табеля",
    ],
    cta: "Начать бесплатно",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 990,
    yearly: 790,
    description: "Для растущей команды",
    popular: true,
    features: [
      "До 20 сотрудников",
      "1 точка",
      "Аналитика и переработки",
      "Отпуска и больничные",
      "Документы по ТК (40+)",
      "Свой шаблон .docx",
      "Экспорт в Excel и PDF",
    ],
    cta: "Попробовать Pro",
  },
  {
    id: "business",
    name: "Business",
    monthly: 2490,
    yearly: 1990,
    description: "Сеть заведений и интеграции",
    features: [
      "Неограниченно сотрудников",
      "До 5 точек 🔒",
      "Всё из Pro +",
      "Мультилокация",
      "API и интеграция с 1С",
      "Приоритетная поддержка",
      "Персональный менеджер",
    ],
    cta: "Связаться с нами",
  },
];

const formatPrice = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

export default function PricingSection() {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanClick = async (plan: Plan) => {
    // trackEvent("Pricing_click", { plan: plan.id });
    
    // Business — открываем модалку
    if (plan.id === "business") {
      setContactOpen(true);
      return;
    }

    // Free — просто на регистрацию
    if (plan.id === "free") {
      navigate("/login?mode=register");
      return;
    }

    // Pro — отправляем на оплату ЮKassa
    if (plan.id === "pro") {
      const token = localStorage.getItem("token");
      
      // Если не авторизован, отправляем на регистрацию
      if (!token) {
        navigate("/login?mode=register");
        return;
      }

      setLoadingPlan(plan.id);

      try {
        const amount = yearly ? plan.yearly * 12 : plan.monthly;
        
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}/payments/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tariffId: plan.id,
              amount: amount,
              description: `Тариф ${plan.name} на ${yearly ? "год" : "месяц"}`,
            }),
          }
        );

        const data = await res.json();

        if (data.confirmationUrl) {
          // Перенаправляем на страницу оплаты ЮKassa
          window.location.href = data.confirmationUrl;
        } else {
          alert(data.error || "Ошибка при создании платежа");
        }
      } catch (err) {
        console.error(err);
        alert("Сетевая ошибка. Проверьте, запущен ли бэкенд.");
      } finally {
        setLoadingPlan(null);
      }
    }
  };

  return (
    <section id="pricing" className="py-16 sm:py-24 bg-slate-50 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Простые тарифы
          </h2>
          <p className="text-lg text-slate-600 mb-6">
            Без скрытых платежей и комиссий. Отмена в один клик.
          </p>

          {/* Переключатель Месяц/Год */}
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                !yearly
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Месяц
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all inline-flex items-center gap-1.5 ${
                yearly
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Год
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  yearly ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                −20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {PLANS.map((p) => {
            const price = yearly ? p.yearly : p.monthly;
            const isLoading = loadingPlan === p.id;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${
                  p.popular
                    ? "bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-xl shadow-brand-500/20 scale-[1.02] ring-2 ring-brand-500 z-10"
                    : "bg-white border border-slate-200 shadow-sm"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 bg-white text-brand-700 text-xs font-bold rounded-full shadow-md">
                    <Sparkles className="w-3 h-3" />
                    Популярный
                  </div>
                )}

                <h3
                  className={`text-lg font-bold mb-1 ${
                    p.popular ? "text-white" : "text-slate-900"
                  }`}
                >
                  {p.name}
                </h3>
                <p
                  className={`text-sm mb-5 ${
                    p.popular ? "text-white/80" : "text-slate-500"
                  }`}
                >
                  {p.description}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-4xl font-bold ${
                        p.popular ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {price === 0 ? "0" : formatPrice(price)} ₽
                    </span>
                    <span
                      className={`text-sm ${
                        p.popular ? "text-white/70" : "text-slate-500"
                      }`}
                    >
                      /мес
                    </span>
                  </div>
                  {yearly && price > 0 && (
                    <div
                      className={`text-xs mt-1 ${
                        p.popular ? "text-white/70" : "text-slate-500"
                      }`}
                    >
                      {formatPrice(price * 12)} ₽ при оплате за год
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          p.popular ? "text-emerald-300" : "text-emerald-600"
                        }`}
                      />
                      <span className={p.popular ? "text-white/95" : "text-slate-700"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanClick(p)}
                  disabled={isLoading}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                    p.popular
                      ? "bg-white text-brand-700 hover:bg-slate-100 shadow-sm"
                      : "bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow"
                  } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Создание платежа...
                    </>
                  ) : (
                    <>
                      {p.cta}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Что входит во все тарифы */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500 font-semibold mb-5 uppercase tracking-wide">
            Во все тарифы включено
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-slate-700">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              HTTPS-шифрование данных
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              Ежедневные бэкапы
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              Автоматические обновления
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              Техническая поддержка
            </span>
          </div>
        </div>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </section>
  );
}