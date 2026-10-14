import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Clock,
  Wallet,
  Users as UsersIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { analyticsApi, type AnalyticsSummary } from "../api/analytics";
import NavBar from "../components/NavBar";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(
    lastDate
  ).padStart(2, "0")}`;
  return { from: first, to: last };
}

export default function AnalyticsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = monthRange(year, month);
    setLoading(true);
    setError(null);
    analyticsApi
      .summary(from, to)
      .then(setData)
      .catch((e) =>
        setError(e.response?.data?.error ?? "Ошибка загрузки")
      )
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const maxHours = data?.users.reduce(
    (m, u) => Math.max(m, u.plannedHours),
    0
  ) ?? 0;

  const PlanVsFactIcon =
    !data || data.planVsFact.plannedHours === 0
      ? Minus
      : data.planVsFact.diffPercent > 5
      ? TrendingUp
      : data.planVsFact.diffPercent < -5
      ? TrendingDown
      : Minus;

  const planVsFactColor =
    !data || data.planVsFact.plannedHours === 0
      ? "text-slate-400"
      : data.planVsFact.diffPercent > 5
      ? "text-emerald-600"
      : data.planVsFact.diffPercent < -5
      ? "text-red-600"
      : "text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Аналитика</h1>
          <p className="text-sm text-slate-500 mt-1">
            Загрузка сотрудников и фонд оплаты труда
          </p>
        </div>

        {/* Навигация по месяцам */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-slate-900 min-w-[160px] text-center">
              {MONTHS_RU[month]} {year}
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
            >
              Текущий месяц
            </button>
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {data && (
          <>
            {/* Метрики */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={Clock}
                iconBg="bg-blue-50 text-blue-600"
                label="Всего часов"
                value={data.totals.hours}
                hint={`${data.totals.shifts} смен`}
              />
              <MetricCard
                icon={UsersIcon}
                iconBg="bg-violet-50 text-violet-600"
                label="Сотрудников"
                value={data.users.length}
              />
              <MetricCard
                icon={Wallet}
                iconBg="bg-emerald-50 text-emerald-600"
                label="ФОТ за месяц"
                value={formatMoney(data.totals.payroll)}
              />
              <MetricCard
                icon={PlanVsFactIcon}
                iconBg="bg-amber-50 text-amber-600"
                label="План vs факт"
                value={`${data.planVsFact.diffPercent > 0 ? "+" : ""}${
                  data.planVsFact.diffPercent
                }%`}
                hint={`План ${data.planVsFact.plannedHours} ч · Факт ${data.planVsFact.actualHours} ч`}
                customColor={planVsFactColor}
              />
            </div>

            {/* Загрузка сотрудников */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-900">
                  Загрузка сотрудников
                </h3>
              </div>

              {data.users.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-500">
                  Нет данных за выбранный период
                </div>
              )}

              {data.users.length > 0 && (
                <div className="space-y-3">
                  {data.users.map((u) => {
                    const percent = maxHours > 0
                      ? (u.plannedHours / maxHours) * 100
                      : 0;
                    return (
                      <div key={u.userId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(
                                u.userId
                              )}`}
                            >
                              {initials(u.name)}
                            </div>
                            <span className="font-medium text-slate-900 truncate">
                              {u.name}
                            </span>
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              {ROLE_LABELS[u.role]}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600 shrink-0 ml-3">
                            <span className="font-semibold text-slate-900">
                              {u.plannedHours} ч
                            </span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span>{u.shiftsCount} смен</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${avatarColor(u.userId)} transition-all`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Таблица сотрудников */}
            {data.users.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">
                    Разбивка по сотрудникам
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Сотрудник
                        </th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Ставка
                        </th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Смен
                        </th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Часов
                        </th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          К выплате
                        </th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Доля ФОТ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => {
                        const share = data.totals.payroll > 0
                          ? (u.payroll / data.totals.payroll) * 100
                          : 0;
                        return (
                          <tr
                            key={u.userId}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${avatarColor(
                                    u.userId
                                  )}`}
                                >
                                  {initials(u.name)}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {u.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {ROLE_LABELS[u.role]}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {u.hourlyRate ? `${u.hourlyRate} ₽/ч` : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-slate-700">
                              {u.shiftsCount}
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-900">
                              {u.plannedHours}
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-900">
                              {u.payroll > 0 ? formatMoney(u.payroll) : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {share > 0 ? `${Math.round(share)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                        <td className="px-5 py-3.5">ИТОГО</td>
                        <td className="px-5 py-3.5"></td>
                        <td className="px-5 py-3.5">{data.totals.shifts}</td>
                        <td className="px-5 py-3.5">{data.totals.hours}</td>
                        <td className="px-5 py-3.5">
                          {formatMoney(data.totals.payroll)}
                        </td>
                        <td className="px-5 py-3.5">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  iconBg,
  label,
  value,
  hint,
  customColor,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: string | number;
  hint?: string;
  customColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-fade-in">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${
          customColor ?? "text-slate-900"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}