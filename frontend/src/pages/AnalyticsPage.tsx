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
  AlertTriangle,
  Banknote
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
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
  return { from: first, to: last };
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#6366f1", "#ec4899"];

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
      .catch((e) => setError(e.response?.data?.error ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const PlanVsFactIcon = !data || data.planVsFact.plannedHours === 0 ? Minus : data.planVsFact.diffPercent > 5 ? TrendingUp : data.planVsFact.diffPercent < -5 ? TrendingDown : Minus;
  const planVsFactColor = !data || data.planVsFact.plannedHours === 0 ? "text-slate-400" : data.planVsFact.diffPercent > 5 ? "text-emerald-600" : data.planVsFact.diffPercent < -5 ? "text-red-600" : "text-slate-500";

  let currentPercent = 0;
  const pieGradient = data?.users.map((u, i) => {
    const start = currentPercent;
    const percent = data.totals.payroll > 0 ? (u.plannedPayroll / data.totals.payroll) * 100 : 0;
    currentPercent += percent;
    return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${currentPercent}%`;
  }).join(", ");

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Аналитика</h1>
            <p className="text-sm text-slate-500 mt-1">Загрузка сотрудников, ФОТ и переработки</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <div className="font-semibold text-slate-900 min-w-[160px] text-center">{MONTHS_RU[month]} {year}</div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={goToday} className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors">Текущий месяц</button>
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {data && (
          <>
            {/* МЕТРИКИ */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <MetricCard icon={Clock} iconBg="bg-blue-50 text-blue-600" label="План часов" value={data.totals.hours} hint={`${data.totals.shifts} смен`} />
              <MetricCard icon={Wallet} iconBg="bg-violet-50 text-violet-600" label="План ФОТ" value={formatMoney(data.totals.payroll)} />
              <MetricCard icon={Banknote} iconBg="bg-indigo-50 text-indigo-600" label="Средняя цена смены" value={formatMoney(data.totals.avgCost)} />
              <MetricCard icon={Banknote} iconBg="bg-emerald-50 text-emerald-600" label="Факт ФОТ (выплачено)" value={formatMoney(data.totals.actualPayroll)} highlight />
              <MetricCard icon={AlertTriangle} iconBg="bg-amber-50 text-amber-600" label="Стоимость переработок" value={formatMoney(data.totals.overtimeCost)} alert={data.totals.overtimeCost > 0} />
              <MetricCard icon={PlanVsFactIcon} iconBg="bg-slate-50 text-slate-600" label="План vs Факт (часы)" value={`${data.planVsFact.diffPercent > 0 ? "+" : ""}${data.planVsFact.diffPercent}%`} customColor={planVsFactColor} hint={`Факт: ${data.planVsFact.actualHours} ч`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* КРУГОВАЯ ДИАГРАММА */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center">
                <h3 className="font-semibold text-slate-900 w-full text-left mb-4">Структура ФОТ</h3>
                {data.totals.payroll === 0 ? (
                  <div className="text-slate-400 text-sm py-10">Нет данных для отображения</div>
                ) : (
                  <div className="relative w-48 h-48 rounded-full mb-6" style={{ background: `conic-gradient(${pieGradient})` }}>
                    <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col shadow-inner">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Всего ФОТ</span>
                      <span className="text-lg font-bold text-slate-900">{formatMoney(data.totals.payroll)}</span>
                    </div>
                  </div>
                )}
                <div className="w-full space-y-2">
                  {data.users.slice(0, 5).map((u, i) => (
                    <div key={u.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                        <span className="text-slate-700 truncate max-w-[120px]">{u.name}</span>
                      </div>
                      <span className="font-medium text-slate-900">{Math.round((u.plannedPayroll / (data.totals.payroll || 1)) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ЗАГРУЗКА СОТРУДНИКОВ (БАРЧАРТ) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">Загрузка сотрудников (Часы)</h3>
                </div>

                {data.users.length === 0 && <div className="text-center py-8 text-sm text-slate-500">Нет данных</div>}

                <div className="space-y-4">
                  {data.users.map((u) => {
                    const maxHours = Math.max(...data.users.map(x => Math.max(x.plannedHours, x.actualHours)), 1);
                    const planPct = (u.plannedHours / maxHours) * 100;
                    const factPct = (u.actualHours / maxHours) * 100;

                    return (
                      <div key={u.userId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(u.userId)}`}>{initials(u.name)}</div>
                            <span className="font-medium text-slate-900 truncate">{u.name}</span>
                            <span className="text-xs text-slate-400 hidden sm:inline">{ROLE_LABELS[u.role]}</span>
                          </div>
                          <div className="text-xs text-slate-600 shrink-0 ml-3 flex gap-3 text-right">
                            <span className="text-blue-600 font-medium">План: {u.plannedHours} ч</span>
                            <span className="text-emerald-600 font-medium">Факт: {u.actualHours} ч</span>
                          </div>
                        </div>
                        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="absolute top-0 bottom-0 left-0 bg-blue-300 transition-all z-0" style={{ width: `${planPct}%` }} />
                          <div className="absolute top-0 bottom-0 left-0 bg-emerald-500 transition-all z-10 opacity-80 mix-blend-multiply" style={{ width: `${factPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ТАБЛИЦА */}
            {data.users.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">Детализация по сотрудникам</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Сотрудник</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Ставка</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Смен / План ч</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Факт ч</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">План ФОТ</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Факт ФОТ</th>
                        <th className="px-5 py-3 font-medium text-slate-600 text-xs uppercase">Переработка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr key={u.userId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0 ${avatarColor(u.userId)}`}>{initials(u.name)}</div>
                              <div>
                                <div className="font-medium text-slate-900">{u.name}</div>
                                <div className="text-xs text-slate-500">{ROLE_LABELS[u.role]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{u.hourlyRate ? `${u.hourlyRate} ₽/ч` : "—"}</td>
                          <td className="px-5 py-3.5 text-slate-700">{u.shiftsCount} / <span className="font-medium text-blue-600">{u.plannedHours}</span></td>
                          <td className="px-5 py-3.5 font-medium text-emerald-600">{u.actualHours}</td>
                          <td className="px-5 py-3.5 text-slate-900">{u.plannedPayroll > 0 ? formatMoney(u.plannedPayroll) : "—"}</td>
                          <td className="px-5 py-3.5 font-medium text-slate-900">{u.actualPayroll > 0 ? formatMoney(u.actualPayroll) : "—"}</td>
                          <td className="px-5 py-3.5">
                            {u.overtimeCost > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-md">
                                <AlertTriangle className="w-3 h-3" /> {formatMoney(u.overtimeCost)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                        <td className="px-5 py-3.5">ИТОГО</td>
                        <td className="px-5 py-3.5"></td>
                        <td className="px-5 py-3.5">{data.totals.shifts} / {data.totals.hours}</td>
                        <td className="px-5 py-3.5 text-emerald-600">{data.planVsFact.actualHours}</td>
                        <td className="px-5 py-3.5">{formatMoney(data.totals.payroll)}</td>
                        <td className="px-5 py-3.5 text-emerald-600">{formatMoney(data.totals.actualPayroll)}</td>
                        <td className="px-5 py-3.5 text-amber-600">{data.totals.overtimeCost > 0 ? formatMoney(data.totals.overtimeCost) : "—"}</td>
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

function MetricCard({ icon: Icon, iconBg, label, value, hint, customColor, highlight, alert }: any) {
  return (
    <div className={`rounded-2xl border shadow-sm p-5 animate-fade-in ${highlight ? 'bg-emerald-50 border-emerald-200' : alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${customColor ?? "text-slate-900"}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}