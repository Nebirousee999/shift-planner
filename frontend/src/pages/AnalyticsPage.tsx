import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, BarChart3, Clock, Wallet, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Banknote, CalendarDays, Briefcase, Loader2, ShieldAlert,
  Users, Target, Flame, History, X // <--- ДОБАВЛЕНА ИКОНКА X
} from "lucide-react";
import { analyticsApi } from "../api/analytics";
import { historyApi } from "../api/history";
import { useLocations } from "../store/locations";
import NavBar from "../components/NavBar";

const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const ROLE_LABELS: Record<string, string> = { OWNER: "Владелец", MANAGER: "Менеджер", EMPLOYEE: "Сотрудник" };
const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#6366f1", "#ec4899"];

function formatMoney(n: number) { return new Intl.NumberFormat("ru-RU").format(n) + " ₽"; }
function monthRange(year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
  return { from: first, to: last };
}

type Tab = "overview" | "history" | "workload" | "discipline" | "details";

export default function AnalyticsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const { activeLocationId, items: locations, fetch: fetchLocations } = useLocations();
  const [scope, setScope] = useState<"active" | "all">("active");

  const locationId = scope === "active" ? activeLocationId ?? undefined : undefined;

  // Состояния для истории
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hFrom, setHFrom] = useState("");
  const [hTo, setHTo] = useState("");
  const [hType, setHType] = useState("");

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  useEffect(() => {
    const { from, to } = monthRange(year, month);
    setLoading(true);
    analyticsApi.summary(from, to, locationId)
      .then(setData)
      .catch((e) => alert("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, month, locationId]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await historyApi.list({ from: hFrom, to: hTo, type: hType });
      setHistoryData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, hFrom, hTo, hType]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Загрузка...</div>;
  if (!data) return <div className="min-h-screen bg-slate-50 p-8 text-center text-red-500">Ошибка данных</div>;

  const totalShifts = data.totals.shifts;
  const openShifts = data.totals.unassignedShifts;
  const closedShifts = totalShifts - openShifts;
  const coveragePct = totalShifts > 0 ? Math.round((closedShifts / totalShifts) * 100) : 0;
  const heavyWorkers = data.users.slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Шапка с вкладками */}
        <div className="flex items-center gap-6 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
          <button onClick={() => setTab("overview")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "overview" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Сводка и ФОТ</button>
          
          {/* ВКЛАДКА ИСТОРИИ ПЕРЕМЕЩЕНА СЮДА */}
          <button onClick={() => setTab("history")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "history" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>История действий</button>
          
          <button onClick={() => setTab("workload")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "workload" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Нагрузка персонала</button>
          <button onClick={() => setTab("discipline")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "discipline" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Дисциплина</button>
          <button onClick={() => setTab("details")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "details" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Детализация</button>
        </div>

        {/* Панель фильтров (Скрываем в истории) */}
        {tab !== "history" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
              <div className="font-semibold text-slate-900 min-w-[140px] text-center">{MONTHS_RU[month]} {year}</div>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronRight className="w-4 h-4" /></button>
              {locations.length > 1 && (
                <div className="ml-2 flex items-center gap-1 px-1 py-0.5 bg-slate-100 rounded-lg text-xs">
                  <button onClick={() => setScope("active")} className={`px-2.5 py-1 rounded-md ${scope === "active" ? "bg-white shadow-sm font-medium" : "text-slate-500"}`}>Точка</button>
                  <button onClick={() => setScope("all")} className={`px-2.5 py-1 rounded-md ${scope === "all" ? "bg-white shadow-sm font-medium" : "text-slate-500"}`}>Все</button>
                </div>
              )}
            </div>
            {!data.timeTrackingOn && (
              <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Учёт времени выключен (факт = план)
              </div>
            )}
          </div>
        )}

        {/* ═══ ВКЛАДКА 1: СВОДКА (ФОТ) ═══ */}
        {tab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard icon={Clock} iconBg="bg-blue-50 text-blue-600" label="План часов" value={data.totals.hours} hint={`${data.totals.shifts} смен`} delta={data.totals.mom.hours} />
              <MetricCard icon={Wallet} iconBg="bg-violet-50 text-violet-600" label="План ФОТ" value={formatMoney(data.totals.payroll)} delta={data.totals.mom.payroll} />
              <MetricCard icon={Banknote} iconBg="bg-emerald-50 text-emerald-600" label="Факт ФОТ" value={formatMoney(data.totals.actualPayroll)} highlight delta={data.totals.mom.actualPayroll} />
              <MetricCard icon={AlertTriangle} iconBg="bg-amber-50 text-amber-600" label="Переработки" value={formatMoney(data.totals.overtimeCost)} alert={data.totals.overtimeCost > 0} />
              <MetricCard icon={Target} iconBg="bg-indigo-50 text-indigo-600" label="Покрытие смен" value={`${coveragePct}%`} hint={`${openShifts} без сотрудника`} />
              <MetricCard icon={TrendingUp} iconBg="bg-slate-50 text-slate-600" label="План vs Факт" value={`${data.planVsFact.diffPercent > 0 ? "+" : ""}${data.planVsFact.diffPercent}%`} hint={`Факт: ${data.planVsFact.actualHours} ч`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-semibold text-slate-900 mb-4">ФОТ по должностям</h3>
                <div className="space-y-4">
                  {data.byPosition.map((p: any, i: number) => (
                    <div key={p.position}>
                      <div className="flex justify-between text-sm mb-1"><span>{p.position}</span> <span className="font-semibold">{formatMoney(p.payroll)}</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${p.percent}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Нагрузка по дням недели</h3>
                <div className="space-y-3">
                  {data.byWeekday.map((w: any) => {
                    const maxShifts = Math.max(...data.byWeekday.map((x: any) => x.shifts), 1);
                    return (
                      <div key={w.weekday} className="flex items-center gap-3 text-sm">
                        <span className="w-8 font-medium">{w.label}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                          <div className="h-full bg-blue-500" style={{ width: `${(w.shifts / maxShifts) * 100}%` }} />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white">{w.shifts} см.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ВКЛАДКА 2: ИСТОРИЯ ДЕЙСТВИЙ ═══ */}
        {tab === "history" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
              <div className="flex gap-2 items-center text-sm">
                <span className="text-slate-500">Период:</span>
                <input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)} className="!w-auto !py-1.5" />
                <span className="text-slate-400">—</span>
                <input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)} className="!w-auto !py-1.5" />
              </div>
              <div className="flex gap-2 items-center text-sm">
                <span className="text-slate-500">Действие:</span>
                <select value={hType} onChange={(e) => setHType(e.target.value)} className="!w-auto !py-1.5">
                  <option value="">Все действия</option>
                  <option value="PUBLISH">Публикация расписания</option>
                  <option value="DISCIPLINE">Изменение дисциплины</option>
                  <option value="SHIFT_CREATE">Создание смен</option>
                  <option value="SHIFT_UPDATE">Изменение смен</option>
                  <option value="VACATION">Отпуска</option>
                  <option value="SICK_LEAVE">Больничные</option>
                  <option value="TIME_OFF">Отгулы</option>
                  <option value="SWAP">Обмены сменами</option>
                </select>
              </div>
              {(hFrom || hTo || hType) && (
                <button onClick={() => { setHFrom(""); setHTo(""); setHType(""); }} className="text-xs text-slate-500 hover:text-slate-900 ml-auto flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Сбросить фильтры
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" /> Лента событий
              </div>
              <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                {historyLoading ? <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Загрузка...</div> : historyData.length === 0 ? <div className="p-8 text-center text-slate-500">Нет событий за выбранный период</div> : historyData.map((h: any) => (
                  <div key={h.id} className="p-4 hover:bg-slate-50 flex items-start gap-4">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-brand-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900">{h.description}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Автор: <span className="font-medium text-slate-700">{h.userName}</span> · {new Date(h.createdAt).toLocaleString("ru-RU")}</div>
                    </div>
                    <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide shrink-0">{h.actionType}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ВКЛАДКА 3: НАГРУЗКА ═══ */}
        {tab === "workload" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                <div className="text-sm font-semibold text-slate-500 mb-2">ПОКРЫТИЕ СМЕН</div>
                <div className="relative w-32 h-32 rounded-full flex items-center justify-center mb-4" style={{ background: `conic-gradient(#10b981 ${coveragePct}%, #f1f5f9 ${coveragePct}%)` }}>
                  <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-slate-900">{coveragePct}%</span>
                  </div>
                </div>
                <div className="text-sm text-slate-600">Закрыто <b>{closedShifts}</b> из <b>{totalShifts}</b></div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Flame className="w-5 h-5 text-orange-500" /> Риск выгорания (ТОП по часам)</h3>
                <div className="space-y-3">
                  {heavyWorkers.map((u: any) => (
                    <div key={u.userId} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">{u.name.charAt(0)}</div>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.position || "—"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{u.actualHours} ч</div>
                        <div className="text-xs text-slate-500">{u.shiftsCount} смен</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Детальная нагрузка по сотрудникам</div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr><th className="px-4 py-3">Сотрудник</th><th className="px-4 py-3">Смен</th><th className="px-4 py-3">План ч</th><th className="px-4 py-3">Факт ч</th><th className="px-4 py-3 text-right">ФОТ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.users.map((u: any) => (
                    <tr key={u.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name} <span className="text-xs text-slate-400 ml-1">{u.paymentType === "MONTHLY" ? "(Оклад)" : ""}</span></td>
                      <td className="px-4 py-3">{u.shiftsCount}</td>
                      <td className="px-4 py-3">{u.plannedHours}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{u.actualHours}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(u.actualPayroll)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ ВКЛАДКА 4: ДИСЦИПЛИНА ═══ */}
        {tab === "discipline" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-slate-500 mb-1">ОПОЗДАНИЯ</div>
                <div className="text-2xl font-bold text-amber-600">{data.discipline.late}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-slate-500 mb-1">РАННИЙ УХОД</div>
                <div className="text-2xl font-bold text-amber-600">{data.discipline.early}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="text-xs font-semibold text-slate-500 mb-1">ПРОГУЛЫ</div>
                <div className="text-2xl font-bold text-rose-600">{data.discipline.noShow}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" /> Лента нарушений
              </div>
              <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                {data.discipline.feed.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Нарушений нет. Отличная работа!</div>
                ) : data.discipline.feed.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${f.type === "Прогул" ? "bg-rose-500" : "bg-amber-500"}`} />
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{f.userName}</div>
                        <div className="text-xs text-slate-500">{f.position}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${f.type === "Прогул" ? "text-rose-600" : "text-amber-600"}`}>{f.type}</div>
                      <div className="text-xs text-slate-500">{f.date} {f.minutes > 0 ? `· ${f.minutes} мин` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ВКЛАДКА 5: ДЕТАЛИЗАЦИЯ ═══ */}
        {tab === "details" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
             <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Детализация по сотрудникам</div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-5 py-3">Сотрудник</th><th className="px-5 py-3">Ставка/Оклад</th><th className="px-5 py-3">Смен / План ч</th><th className="px-5 py-3">Факт ч</th><th className="px-5 py-3">План ФОТ</th><th className="px-5 py-3">Факт ФОТ</th><th className="px-5 py-3">Переработка</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.users.map((u: any) => (
                      <tr key={u.userId} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium">{u.name} <div className="text-xs text-slate-400">{ROLE_LABELS[u.role]}</div></td>
                        <td className="px-5 py-3">{u.hourlyRate ? `${u.hourlyRate} ₽` : "—"} <span className="text-[10px] text-slate-400 block">{u.paymentType === "MONTHLY" ? "оклад" : "час"}</span></td>
                        <td className="px-5 py-3">{u.shiftsCount} / {u.plannedHours}</td>
                        <td className="px-5 py-3 text-emerald-600 font-medium">{u.actualHours}</td>
                        <td className="px-5 py-3">{formatMoney(u.plannedPayroll)}</td>
                        <td className="px-5 py-3 font-bold">{formatMoney(u.actualPayroll)}</td>
                        <td className="px-5 py-3 text-amber-600">{u.overtimeCost > 0 ? formatMoney(u.overtimeCost) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, iconBg, label, value, hint, customColor, highlight, alert, delta }: any) {
  return (
    <div className={`rounded-2xl border shadow-sm p-4 flex flex-col justify-between ${highlight ? "bg-emerald-50 border-emerald-200" : alert ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}><Icon className="w-4 h-4" /></div>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        <div className={`text-xl font-bold ${customColor ?? "text-slate-900"}`}>{value}</div>
        {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-slate-400"><Minus className="w-3 h-3 inline" /> 0%</span>;
  const isUp = value > 0;
  return <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${isUp ? "text-emerald-600" : "text-rose-600"}`}>{isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{value}%</span>;
}