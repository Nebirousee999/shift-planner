import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet, CheckCircle2, AlertTriangle, Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "../store/auth";
import { paymentsApi, type CurrentSubscription, type Payment } from "../api/payments";
import { trackEvent } from "../lib/metrika";
import NavBar from "../components/NavBar";

const TARIFFS = {
  free: {
    name: "Free",
    features: ["3 сотрудника", "1 точка", "Базовый график смен"],
  },
  pro: {
    name: "Pro",
    features: [
      "До 20 сотрудников",
      "Аналитика и переработки",
      "Отпуска и больничные",
      "Документы по ТК (10+)",
      "Свой шаблон .docx",
    ],
  },
  business: {
    name: "Business",
    features: [
      "Неограниченно сотрудников",
      "До 5 точек",
      "Всё из Pro +",
      "API и интеграция с 1С",
      "Приоритетная поддержка",
    ],
  },
};

const PRICES = {
  pro: { monthly: 990, yearly: 9480 },
  business: { monthly: 2490, yearly: 23880 },
};

const fmtMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export default function WalletPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === import.meta.env.VITE_ADMIN_EMAIL;
  const [testPaying, setTestPaying] = useState(false);
  const [searchParams] = useSearchParams();
  const checkoutPlan = searchParams.get("checkout") as "pro" | "business" | null;

  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    Promise.all([paymentsApi.current(), paymentsApi.history()])
      .then(([c, h]) => {
        setCurrent(c);
        setHistory(h);
        setLoading(false);

        // 🎯 Авто-оплата: если пришёл с лендинга с намерением купить
        if (checkoutPlan && c && (c.tariffId === "free" || (c as any).isTrial)) {
          // Восстанавливаем yearly из sessionStorage
          let pendingYearly = false;
          try {
            const pending = sessionStorage.getItem("pendingCheckout");
            if (pending) {
              pendingYearly = JSON.parse(pending).yearly === true;
            }
          } catch {}

          sessionStorage.removeItem("pendingCheckout");
          setYearly(pendingYearly);

          // Небольшая пауза, чтобы UI отрисовался
          setTimeout(() => {
            handlePay(checkoutPlan, pendingYearly);
          }, 500);
        } else {
          // Если оплата не нужна (уже есть Pro) — просто чистим флаг
          sessionStorage.removeItem("pendingCheckout");
        }
      })
      .catch(() => {
        alert("Ошибка загрузки данных кошелька");
        setLoading(false);
      });
  }, [checkoutPlan]);

  const handleTestPay = async () => {
    setTestPaying(true);
    try {
      const { confirmationUrl } = await paymentsApi.create(
        "pro",
        1,
        "Тестовая оплата 1₽ (Pro на 30 дней)"
      );
      window.location.href = confirmationUrl;
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания тестового платежа");
      setTestPaying(false);
    }
  };

  const handlePay = async (tariffId: "pro" | "business", overrideYearly?: boolean) => {
    trackEvent("ym-begin-checkout", { tariff: tariffId });
    const useYearly = overrideYearly !== undefined ? overrideYearly : yearly;
    setPaying(tariffId);
    try {
      const amount = useYearly ? PRICES[tariffId].yearly : PRICES[tariffId].monthly;
      const desc = `Тариф ${TARIFFS[tariffId].name} на ${useYearly ? "год" : "месяц"}`;
      const { confirmationUrl } = await paymentsApi.create(tariffId, amount, desc);
      window.location.href = confirmationUrl;
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания платежа");
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <div className="max-w-4xl mx-auto p-8 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Загрузка...
        </div>
      </div>
    );
  }

  const currentTariffId = current?.tariffId ?? "free";
  const isTrial = (current as any)?.isTrial === true;
  const meta = TARIFFS[currentTariffId];
  const isPaid = currentTariffId !== "free";
  const expired = current?.tariffExpiresAt && !current.isActive;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-brand-600" /> Кошелек
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Управление тарифом, оплата подписки и история платежей
          </p>
        </div>

        {isTrial && current && (
          <div className="mb-6 rounded-2xl p-4 bg-gradient-to-r from-emerald-50 to-brand-50 border-2 border-emerald-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-emerald-900">
                Пробный период Pro: {current.daysLeft ?? 0} {(current.daysLeft ?? 0) === 1 ? "день" : (current.daysLeft ?? 0) < 5 ? "дня" : "дней"} осталось
              </div>
              <div className="text-emerald-700 mt-1">
                Все Pro-функции активны. Чтобы сохранить их, оформите подписку до окончания триала — данные и настройки не потеряются.
              </div>
            </div>
          </div>
        )}

        {/* Текущий тариф */}
        <div
          className={`rounded-2xl p-6 sm:p-8 mb-6 ${
            currentTariffId === "free"
              ? "bg-white border-2 border-slate-200"
              : currentTariffId === "pro"
              ? "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white shadow-xl"
              : "bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 text-white shadow-xl"
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className={`text-xs uppercase tracking-wide mb-1 ${isPaid ? "text-white/70" : "text-slate-400"}`}>
                Текущий тариф
              </div>
              <div className="text-3xl sm:text-4xl font-bold">{meta.name}</div>
            </div>
            {current?.tariffExpiresAt && (
              <div className="text-right text-sm">
                {current.isActive ? (
                  <>
                    <div className={isPaid ? "text-white/70" : "text-slate-500"}>
                      Активен до{" "}
                      {new Date(current.tariffExpiresAt).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </div>
                    <div className={`text-xs mt-1 ${isPaid ? "text-white/80 font-semibold" : "text-slate-600"}`}>
                      {current.daysLeft} {current.daysLeft === 1 ? "день" : current.daysLeft! < 5 ? "дня" : "дней"} осталось
                    </div>
                  </>
                ) : (
                  <div className="text-rose-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Истёк
                  </div>
                )}
              </div>
            )}
          </div>

          <ul className="space-y-1.5 text-sm mb-6">
            {meta.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isPaid ? "text-emerald-300" : "text-emerald-600"}`} />
                {f}
              </li>
            ))}
          </ul>

          {currentTariffId !== "business" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePay("pro")}
                disabled={!!paying}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 ${
                  isPaid
                    ? "bg-white text-brand-700 hover:bg-slate-100"
                    : "bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                }`}
              >
                {paying === "pro" && <Loader2 className="w-4 h-4 animate-spin" />}
                {currentTariffId === "free" ? "Оформить Pro" : "Продлить Pro"} —{" "}
                {fmtMoney(yearly ? PRICES.pro.yearly : PRICES.pro.monthly)} / {yearly ? "год" : "мес"}
              </button>
              {currentTariffId === "pro" && (
                <button
                  onClick={() => handlePay("business")}
                  disabled={!!paying}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-white/20 border border-white/30 text-white hover:bg-white/30 transition-all disabled:opacity-50"
                >
                  {paying === "business" && <Loader2 className="w-4 h-4 animate-spin" />}
                  Улучшить до Business — {fmtMoney(yearly ? PRICES.business.yearly : PRICES.business.monthly)} / {yearly ? "год" : "мес"}
                </button>
              )}
            </div>
          )}
          {currentTariffId === "business" && (
            <button
              onClick={() => handlePay("business")}
              disabled={!!paying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-white text-violet-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {paying === "business" && <Loader2 className="w-4 h-4 animate-spin" />}
              Продлить Business — {fmtMoney(yearly ? PRICES.business.yearly : PRICES.business.monthly)} / {yearly ? "год" : "мес"}
            </button>
          )}
        </div>

        {/* 🧪 Тестовая оплата (только для админа) */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-amber-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Тестовая оплата
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Реальный платёж 1 ₽ через YooKassa. Pro активируется на 30 дней.
              </div>
            </div>
            <button
              onClick={handleTestPay}
              disabled={testPaying}
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-medium shadow-sm whitespace-nowrap"
            >
              {testPaying && <Loader2 className="w-4 h-4 animate-spin" />}
              {testPaying ? "Создание..." : "Оплатить 1 ₽"}
            </button>
          </div>
        )}

        {/* Переключатель месяц/год */}
        {currentTariffId !== "business" && (
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
              <button
                onClick={() => setYearly(false)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  !yearly ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Месяц
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  yearly ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Год
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${yearly ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                  −20%
                </span>
              </button>
            </div>
          </div>
        )}

        {/* История */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">
            История платежей
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              У вас пока нет ни одного платежа
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((p) => {
                const meta = p.metadata as any;
                const isSuccess = p.status === "succeeded";
                const isCanceled = p.status === "canceled";
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {p.description}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(p.createdAt).toLocaleString("ru-RU")}
                        {meta?.tariffId && ` · ${meta.tariffId === "pro" ? "Pro" : "Business"}`}
                        {meta?.isYearly === "true" && " · Год"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900">
                        {fmtMoney(Number(p.amount))}
                      </div>
                      <div
                        className={`text-xs font-medium ${
                          isSuccess ? "text-emerald-600" : isCanceled ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {isSuccess ? "Оплачено" : isCanceled ? "Отменён" : "В обработке"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>Важно:</b> при оплате вы будете перенаправлены на защищенную страницу ЮKassa.
            Тариф активируется автоматически в течение 1–2 минут после оплаты.
          </div>
        </div>
      </main>
    </div>
  );
}
