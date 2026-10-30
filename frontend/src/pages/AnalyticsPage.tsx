import { useEffect, useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Clock, Wallet, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Banknote, Loader2, ShieldAlert,
  Target, Flame, MapPin, Search, Users
} from "lucide-react";
import { analyticsApi } from "../api/analytics";
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

type Tab = "overview" | "workload" | "discipline" | "details";

export default function AnalyticsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const { activeLocationId, items: locations, fetch: fetchLocations } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  useEffect(() => { fetchLocations(); }, [fetchLocations]);
  useEffect(() => { if (activeLocationId) setSelectedLocationId(activeLocationId); }, [activeLocationId]);

  const locationId = selectedLocationId || undefined;

  // Дисциплина
  const [discSearch, setDiscSearch] = useState("");
  const [discType, setDiscType] = useState<"all" | "Опоздание" | "Ранний уход" | "Прогул">("all");
  const [discMode, setDiscMode] = useState<"feed" | "summary">("feed");

  useEffect(() => {
    const { from, to } = monthRange(year, month);
    setLoading(true);
    analyticsApi.summary(from, to, locationId)
      .then(setData)
      .catch(() => alert("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, month, locationId]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Фильтрация и Суммирование дисциплины
  const filteredDiscFeed = useMemo(() => {
    if (!data?.discipline?.feed) return [];
    return data.discipline.feed.filter((f: any) => {
      const matchName = f.userName.toLowerCase().includes(discSearch.toLowerCase());
      const matchType = discType === "all" || f.type === discType;
      return matchName && matchType;
    });
  }, [data, discSearch, discType]);

  const summaryDisc = useMemo(() => {
    if (!data?.discipline?.feed) return [];
    const map = new Map<string, { name: string; position: string; lateMins: number; earlyMins: number; noShows: number }>();

    for (const f of data.discipline.feed) {
      if (!map.has(f.userName)) {
        map.set(f.userName, { name: f.userName, position: f.position, lateMins: 0, earlyMins: 0, noShows: 0 });
      }
      const item = map.get(f.userName)!;
      if (f.type === "Опоздание") item.lateMins += f.minutes;
      else if (f.type === "Ранний уход") item.earlyMins += f.minutes;
      else if (f.type === "Прогул") item.noShows += 1;
    }

    let arr = Array.from(map.values());
    
    // Фильтруем по имени
    if (discSearch) {
      arr = arr.filter(u => u.name.toLowerCase().includes(discSearch.toLowerCase()));
    }

    // Сортируем по сумме (вес прогула = 100 минут для приоритета)
    return arr.sort((a, b) => {
      const scoreA = a.lateMins + a.earlyMins + (a.noShows * 100);
      const scoreB = b.lateMins + b.earlyMins + (b.noShows * 100);
      return scoreB - scoreA;
    });
  }, [data, discSearch]);

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

        {/* Шапка с вкладками и фильтром точек */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-6 overflow-x-auto pb-1 gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => setTab("overview")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "overview" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Сводка и ФОТ</button>
            <button onClick={() => setTab("workload")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "workload" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Нагрузка персонала</button>
            <button onClick={() => setTab("discipline")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "discipline" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Дисциплина</button>
            <button onClick={() => setTab("details")} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === "details" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Детализация</button>
          </div>

          {/* Фильтр по точкам */}
          <div className="flex items-center gap-2 pb-3 pr-1 shrink-0">
            <MapPin className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedLocationId} 
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="!w-auto !py-1 !text-xs !bg-white border-slate-200"
            >
              <option value="">Все точки</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* Панель месяца */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
            <div className="font-semibold text-slate-900 min-w-[140px] text-center">{MONTHS_RU[month]} {year}</div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {!data.timeTrackingOn && (
            <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Учёт времени выключен (факт = план)
            </div>
          )}
        </div>

        {/* ═══ СВОДКА ═══ */}
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

        {/* ═══ НАГРУЗКА ═══ */}
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

        {/* ═══ ДИСЦИПЛИНА ═══ */}
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

            {/* Фильтры дисциплины */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input 
                  value={discSearch} 
                  onChange={(e) => setDiscSearch(e.target.value)} 
                  placeholder="Поиск по фамилии..." 
                  className="!pl-9 !py-1.5 !text-sm" 
                />
              </div>
              <select 
                value={discType} 
                onChange={(e) => setDiscType(e.target.value as any)}
                className="!w-auto !py-1.5 !text-sm"
              >
                <option value="all">Все нарушения</option>
                <option value="Опоздание">Только опоздания</option>
                <option value="Ранний уход">Только ранний уход</option>
                <option value="Прогул">Только прогулы</option>
              </select>
              
              <div className="flex bg-slate-100 p-1 rounded-lg ml-auto">
                <button
                  onClick={() => setDiscMode("feed")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${discMode === "feed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Лента
                </button>
                <button
                  onClick={() => setDiscMode("summary")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${discMode === "summary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Сводка
                </button>
              </div>
            </div>

            {/* Лента нарушений */}
            {discMode === "feed" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" /> Лента нарушений
                </div>
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                  {filteredDiscFeed.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Нет нарушений по заданным фильтрам</div>
                  ) : filteredDiscFeed.map((f: any, i: number) => (
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
            )}

            {/* Сводка нарушений */}
            {discMode === "summary" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-600" /> Сводка по сотрудникам (сортировка от худших)
                </div>
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-5 py-3">Сотрудник</th>
                        <th className="px-5 py-3 text-center">Опоздания (мин)</th>
                        <th className="px-5 py-3 text-center">Ранний уход (мин)</th>
                        <th className="px-5 py-3 text-center">Прогулы (кол-во)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryDisc.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">Нет данных</td></tr>
                      ) : summaryDisc.map((u: any) => (
                        <tr key={u.name} className="hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {u.name} <div className="text-xs text-slate-500 font-normal">{u.position}</div>
                          </td>
                          <td className="px-5 py-3 text-center text-amber-600 font-medium">
                            {u.lateMins > 0 ? u.lateMins : "—"}
                          </td>
                          <td className="px-5 py-3 text-center text-amber-600 font-medium">
                            {u.earlyMins > 0 ? u.earlyMins : "—"}
                          </td>
                          <td className="px-5 py-3 text-center text-rose-600 font-bold">
                            {u.noShows > 0 ? u.noShows : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ДЕТАЛИЗАЦИЯ ═══ */}
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