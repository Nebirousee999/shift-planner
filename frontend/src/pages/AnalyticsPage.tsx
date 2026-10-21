import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Banknote,
  CalendarDays,
  Briefcase,
  FileSpreadsheet,
  FileDown,
  Loader2,
} from "lucide-react";
import { analyticsApi, type AnalyticsSummary } from "../api/analytics";
import { useLocations } from "../store/locations";
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

const PIE_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#6366f1", "#ec4899",
];

type Scope = "active" | "all";

export default function AnalyticsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const { activeLocationId, items: locations, fetch: fetchLocations } = useLocations();
  const [scope, setScope] = useState<Scope>("active");

  // Активная локация — из стора; при "all" передаём undefined
  const locationId =
    scope === "active" ? activeLocationId ?? undefined : undefined;

  // Загружаем локации для переключателя
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Загружаем аналитику
  useEffect(() => {
    const { from, to } = monthRange(year, month);
    setLoading(true);
    setError(null);
    analyticsApi
      .summary(from, to, locationId)
      .then(setData)
      .catch((e) => setError(e.response?.data?.error ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, month, locationId]);

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

  const onExport = async (kind: "excel" | "pdf") => {
    setExporting(kind);
    try {
      const { from, to } = monthRange(year, month);
      if (kind === "excel") await analyticsApi.downloadExcel(from, to, locationId);
      else await analyticsApi.downloadPdf(from, to, locationId);
    } catch (e: any) {
      alert(e.message ?? "Ошибка экспорта");
    } finally {
      setExporting(null);
    }
  };

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

  let currentPercent = 0;
  const pieGradient =
    data?.users
      .map((u, i) => {
        const start = currentPercent;
        const percent =
          data.totals.payroll > 0
            ? (u.plannedPayroll / data.totals.payroll) * 100
            : 0;
        currentPercent += percent;
        return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${currentPercent}%`;
      })
      .join(", ") ?? "";

  const showScopeSwitch = locations.length > 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Аналитика</h1>
            <p className="text-sm text-slate-500 mt-1">
              Загрузка сотрудников, ФОТ, дни недели, структура по должностям
            </p>
          </div>
        </div>

        {/* Навигация по месяцам + scope + экспорт */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-slate-900 min-w-[160px] text-center">
              {MONTHS_RU[month]} {year}
            </div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
            >
              Текущий месяц
            </button>

            {showScopeSwitch && (
              <div className="ml-2 flex items-center gap-1 px-1 py-0.5 bg-slate-100 rounded-lg text-xs">
                <button
                  onClick={() => setScope("active")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    scope === "active"
                      ? "bg-white text-slate-900 shadow-sm font-medium"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Только точка
                </button>
                <button
                  onClick={() => setScope("all")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    scope === "all"
                      ? "bg-white text-slate-900 shadow-sm font-medium"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Все точки
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <div className="text-[11px] text-slate-500 mr-2 hidden md:block">
                Сравнение с{" "}
                <span className="font-medium text-slate-700">{data.prevPeriod.from}</span>
                {" — "}
                <span className="font-medium text-slate-700">{data.prevPeriod.to}</span>
              </div>
            )}

            <button
              onClick={() => onExport("excel")}
              disabled={exporting !== null || !data}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-all"
              title="Скачать Excel"
            >
              {exporting === "excel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              )}
              Excel
            </button>

            <button
              onClick={() => onExport("pdf")}
              disabled={exporting !== null || !data}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-all"
              title="Скачать PDF"
            >
              {exporting === "pdf" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-rose-600" />
              )}
              PDF
            </button>
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {data && (
          <>
            {/* МЕТРИКИ с MoM */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <MetricCard
                icon={Clock}
                iconBg="bg-blue-50 text-blue-600"
                label="План часов"
                value={data.totals.hours}
                hint={`${data.totals.shifts} смен`}
                delta={data.totals.mom.hours}
              />
              <MetricCard
                icon={Wallet}
                iconBg="bg-violet-50 text-violet-600"
                label="План ФОТ"
                value={formatMoney(data.totals.payroll)}
                delta={data.totals.mom.payroll}
              />
              <MetricCard
                icon={Banknote}
                iconBg="bg-indigo-50 text-indigo-600"
                label="Средняя цена смены"
                value={formatMoney(data.totals.avgCost)}
                delta={data.totals.mom.avgCost}
              />
              <MetricCard
                icon={Banknote}
                iconBg="bg-emerald-50 text-emerald-600"
                label="Факт ФОТ (выплачено)"
                value={formatMoney(data.totals.actualPayroll)}
                highlight
                delta={data.totals.mom.actualPayroll}
              />
              <MetricCard
                icon={AlertTriangle}
                iconBg="bg-amber-50 text-amber-600"
                label="Стоимость переработок"
                value={formatMoney(data.totals.overtimeCost)}
                alert={data.totals.overtimeCost > 0}
              />
              <MetricCard
                icon={PlanVsFactIcon}
                iconBg="bg-slate-50 text-slate-600"
                label="План vs Факт (часы)"
                value={`${data.planVsFact.diffPercent > 0 ? "+" : ""}${data.planVsFact.diffPercent}%`}
                customColor={planVsFactColor}
                hint={`Факт: ${data.planVsFact.actualHours} ч`}
              />
            </div>

            {/* ПИРОГ + ЗАГРУЗКА */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center">
                <h3 className="font-semibold text-slate-900 w-full text-left mb-4">
                  Структура ФОТ
                </h3>
                {data.totals.payroll === 0 ? (
                  <div className="text-slate-400 text-sm py-10">
                    Нет данных для отображения
                  </div>
                ) : (
                  <div
                    className="relative w-48 h-48 rounded-full mb-6"
                    style={{ background: `conic-gradient(${pieGradient})` }}
                  >
                    <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col shadow-inner">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                        Всего ФОТ
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatMoney(data.totals.payroll)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="w-full space-y-2">
                  {data.users.slice(0, 5).map((u, i) => (
                    <div key={u.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        ></div>
                        <span className="text-slate-700 truncate max-w-[120px]">
                          {u.name}
                        </span>
                      </div>
                      <span className="font-medium text-slate-900">
                        {Math.round((u.plannedPayroll / (data.totals.payroll || 1)) * 100)}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    Загрузка сотрудников (Часы)
                  </h3>
                </div>

                {data.users.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-500">Нет данных</div>
                )}

                <div className="space-y-4">
                  {data.users.map((u) => {
                    const maxHours = Math.max(
                      ...data.users.map((x) => Math.max(x.plannedHours, x.actualHours)),
                      1
                    );
                    const planPct = (u.plannedHours / maxHours) * 100;
                    const factPct = (u.actualHours / maxHours) * 100;

                    return (
                      <div key={u.userId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(u.userId)}`}>
                              {initials(u.name)}
                            </div>
                            <span className="font-medium text-slate-900 truncate">{u.name}</span>
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              {ROLE_LABELS[u.role]}
                            </span>
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

            {/* ДНИ НЕДЕЛИ + ДОЛЖНОСТИ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">Нагрузка по дням недели</h3>
                  <span className="text-[11px] text-slate-400 ml-auto">смены и ФОТ</span>
                </div>

                {data.byWeekday.every((w) => w.shifts === 0) ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Нет данных за период
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(() => {
                      const maxShifts = Math.max(...data.byWeekday.map((x) => x.shifts), 1);
                      const maxPayroll = Math.max(...data.byWeekday.map((x) => x.payroll), 1);
                      return data.byWeekday.map((w) => {
                        const shiftPct = (w.shifts / maxShifts) * 100;
                        const payrollPct = (w.payroll / maxPayroll) * 100;
                        const isWeekend = w.weekday >= 5;
                        return (
                          <div key={w.weekday} className="flex items-center gap-3">
                            <div className={`w-8 text-sm font-semibold ${isWeekend ? "text-violet-600" : "text-slate-700"}`}>
                              {w.label}
                            </div>
                            <div className="flex-1 relative h-8">
                              <div className="absolute inset-y-0 left-0 right-0 bg-slate-100 rounded-md overflow-hidden">
                                <div
                                  className={`h-full rounded-md transition-all ${isWeekend ? "bg-violet-500" : "bg-blue-500"}`}
                                  style={{ width: `${shiftPct}%` }}
                                />
                              </div>
                              <div className="absolute inset-y-0 left-2 flex items-center gap-2 text-[11px] font-semibold">
                                {w.shifts > 0 ? (
                                  <>
                                    <span className="text-white drop-shadow-sm">{w.shifts} см.</span>
                                    <span className="text-slate-500">{w.plannedHours} ч</span>
                                  </>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </div>
                            <div className="w-28 text-right text-sm shrink-0">
                              <div className="text-slate-900 font-semibold">{formatMoney(w.payroll)}</div>
                              <div className="text-[10px] text-slate-500">{Math.round(payrollPct)}% от макс.</div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  {(() => {
                    const peak = [...data.byWeekday].sort((a, b) => b.shifts - a.shifts)[0];
                    const low = [...data.byWeekday]
                      .filter((w) => w.shifts > 0)
                      .sort((a, b) => a.shifts - b.shifts)[0];
                    if (!peak || peak.shifts === 0) return "Нет данных для сравнения";
                    return (
                      <>
                        Пик нагрузки: <b className="text-slate-800">{peak.label}</b> ({peak.shifts} смен).{" "}
                        {low && low.weekday !== peak.weekday && (
                          <>
                            Минимум: <b className="text-slate-800">{low.label}</b> ({low.shifts} смен).
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">ФОТ по должностям</h3>
                </div>

                {data.byPosition.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">Нет данных</div>
                ) : (
                  <div className="space-y-3.5">
                    {data.byPosition.map((p, i) => {
                      const color = PIE_COLORS[i % PIE_COLORS.length];
                      return (
                        <div key={p.position}>
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                              <span className="font-medium text-slate-900 truncate">{p.position}</span>
                            </div>
                            <div className="text-xs shrink-0">
                              <span className="font-semibold text-slate-900">{formatMoney(p.payroll)}</span>
                              <span className="text-slate-400 ml-1.5">· {p.percent}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${p.percent}%`, backgroundColor: color }} />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {p.shifts} смен · {p.plannedHours} ч
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

function MetricCard({
  icon: Icon,
  iconBg,
  label,
  value,
  hint,
  customColor,
  highlight,
  alert,
  delta,
}: {
  icon: any;
  iconBg: string;
  label: string;
  value: string | number;
  hint?: string;
  customColor?: string;
  highlight?: boolean;
  alert?: boolean;
  delta?: number;
}) {
  return (
    <div
      className={`rounded-2xl border shadow-sm p-5 animate-fade-in ${
        highlight
          ? "bg-emerald-50 border-emerald-200"
          : alert
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className={`text-2xl font-bold ${customColor ?? "text-slate-900"}`}>{value}</div>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5" title="Без изменений к прошлому месяцу">
        <Minus className="w-3 h-3" />0%
      </span>
    );
  }
  const isUp = value > 0;
  return (
    <span
      className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${isUp ? "text-emerald-600" : "text-red-600"}`}
      title="К прошлому месяцу"
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{value}%
    </span>
  );
}