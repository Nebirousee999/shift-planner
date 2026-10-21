import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Clock,
  CalendarDays,
  ChevronRight,
  AlertCircle,
  Timer,
  ArrowRightLeft,
  UserCircle,
  CalendarX2,
  Activity,
  Wallet,
  Banknote,
  FileEdit,
  AlertTriangle,
  X,
} from "lucide-react";
import { dashboardApi, type DashboardSummary } from "../api/dashboard";
import { meApi, type MyProfile } from "../api/me";
import { shiftsApi } from "../api/weeks";
import { useAuth } from "../store/auth";
import { useWeeks } from "../store/weeks";
import { useNotifications } from "../store/notifications";
import NavBar from "../components/NavBar";
import { shortDate, dayLabel, weekDates } from "../lib/dates";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const calcHours = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
};
const formatMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

function timeToPercent(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(h: number): string {
  if (!h || h === 0) return "0 ч";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins} мин`;
  if (mins === 0) return `${hours} ч`;
  return `${hours} ч ${mins} м`;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOCKED: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  LOCKED: "Заблокирован",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { weeks, fetchWeeks } = useWeeks();
  const { vacationsPending, swapsIncoming, shiftChangesIncoming, refresh: refreshNotifs } = useNotifications();
  
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  
  const [disciplineShift, setDisciplineShift] = useState<any | null>(null);
  const [hoveredShift, setHoveredShift] = useState<any | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(), 
      meApi.profile().catch(() => null)
    ])
      .then(([dash, prof]) => {
        setData(dash);
        setProfile(prof);
      })
      .catch(() => alert("Ошибка загрузки дашборда"))
      .finally(() => setLoading(false));
    
    fetchWeeks();
    refreshNotifs();
  }, [fetchWeeks, refreshNotifs]);

  const todayDate = now.toISOString().slice(0, 10);
  const currentTimePercent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  const isEmployee = user?.role === "EMPLOYEE";

  const dates = data?.currentWeek ? weekDates(data.currentWeek.weekStartDate) : [];
  const handleGoToToday = () => navigate(isEmployee ? "/my" : data?.currentWeek?.id ? `/weeks/${data.currentWeek.id}` : "/weeks");

  // --- СТАТИСТИКА СОТРУДНИКА ---
  const hourlyRate = profile?.hourlyRate ? Number(profile.hourlyRate) : 0;
  const myShiftsToday = data?.todayShifts?.filter((s) => s.userId === user?.id) || [];
  const myShiftsWeek = data?.currentWeek?.shifts?.filter((s) => s.userId === user?.id) || [];
  const myEntriesToday = data?.weekTimeEntries?.filter((te) => te.userId === user?.id && String(te.clockIn).slice(0, 10) === todayDate) || [];

  const plannedToday = myShiftsToday.reduce((acc, s) => acc + calcHours(s.startTime, s.endTime), 0);
  const plannedWeek = myShiftsWeek.reduce((acc, s) => acc + calcHours(s.startTime, s.endTime), 0);
  
  const calcActual = (entries: any[]) => {
    let h = 0;
    entries.forEach((te) => {
      const start = new Date(te.clockIn).getTime();
      const end = te.clockOut ? new Date(te.clockOut).getTime() : Date.now();
      h += (end - start) / 3600000;
    });
    return h;
  };
  const actualToday = calcActual(myEntriesToday);
  const actualWeek = calcActual(data?.weekTimeEntries?.filter((te) => te.userId === user?.id) || []);

  let statusText = "Нет смен";
  let isWorking = false;
  if (myShiftsToday.length > 0) {
    const activeEntry = myEntriesToday.find((te) => !te.clockOut);
    const shift = myShiftsToday[0];
    const endParts = shift.endTime.split(":").map(Number);
    const isEnded = now.getHours() > endParts[0] || (now.getHours() === endParts[0] && now.getMinutes() > endParts[1]);
    const startParts = shift.startTime.split(":").map(Number);
    const isStarted = now.getHours() > startParts[0] || (now.getHours() === startParts[0] && now.getMinutes() >= startParts[1]);

    if (activeEntry) { statusText = "В работе"; isWorking = true; }
    else if (isEnded) statusText = "Смена окончена";
    else if (isStarted) { statusText = "В работе"; isWorking = true; }
    else statusText = "Ожидается";
  }

  const todayShiftsToShow = isEmployee ? myShiftsToday : data?.todayShifts || [];

  // --- РАСЧЕТЫ ЗАТРАТ ---
  const allUsers = data?.users || [];
  
  const calcCost = (shifts: any[]) => {
    return shifts.reduce((acc, s) => {
      const u = allUsers.find((x: any) => x.id === s.userId);
      const rate = u?.hourlyRate ? Number(u.hourlyRate) : 0;
      return acc + calcHours(s.startTime, s.endTime) * rate;
    }, 0);
  };

  const todayCost = calcCost(todayShiftsToShow);
  const weekCost = calcCost(data?.currentWeek?.shifts || []);

  const currentMonthStr = todayDate.slice(0, 7);
  let monthShiftsCount = 0;
  let monthCost = 0;
  weeks.forEach(w => {
    if (!String(w.weekStartDate).startsWith(currentMonthStr)) return;
    w.shifts?.forEach(s => {
      if (s.userId) {
        const u = allUsers.find((x: any) => x.id === s.userId);
        const rate = u?.hourlyRate ? Number(u.hourlyRate) : 0;
        monthCost += calcHours(s.startTime, s.endTime) * rate;
        monthShiftsCount++;
      }
    });
  });

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Загрузка...</div>;

  // Расчет данных для верхнего баннера
  let hoveredOvertime = 0;
  if (hoveredShift && hoveredShift.templateStartTime && hoveredShift.templateEndTime) {
    const sStart = timeToMins(hoveredShift.startTime);
    const sEnd = timeToMins(hoveredShift.endTime);
    const tStart = timeToMins(hoveredShift.templateStartTime);
    const tEnd = timeToMins(hoveredShift.templateEndTime);

    if (sStart < tStart) hoveredOvertime += (tStart - sStart);
    if (sEnd > tEnd) hoveredOvertime += (sEnd - tEnd);
  }

  const lateness = hoveredShift?.latenessMinutes || 0;
  const early = hoveredShift?.earlyLeaveMinutes || 0;
  const hasViolation = lateness > 0 || early > 0;

  // Форматируем текст переработки (если больше часа, показываем часы и минуты)
  let overtimeText = "";
  if (hoveredOvertime > 0) {
    overtimeText = hoveredOvertime >= 60 
      ? formatHours(hoveredOvertime / 60) 
      : `${hoveredOvertime} мин`;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        
        {/* ВЕРХНЯЯ ПАНЕЛЬ */}
        {data?.currentWeek ? (
          <button onClick={() => navigate("/weeks")} className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left hover:shadow-md hover:border-brand-300 transition-all flex flex-col group">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  {MONTHS_RU[new Date(data.currentWeek.weekStartDate + "T00:00:00Z").getUTCMonth()]}{" "}
                  {new Date(data.currentWeek.weekStartDate + "T00:00:00Z").getUTCFullYear()}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ring-1 ${STATUS_COLORS[data.currentWeek.status]}`}>
                  {STATUS_LABELS[data.currentWeek.status]}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Смен за неделю</div>
                  <div className="font-bold text-slate-900">{(data.currentWeek.shifts || []).length}</div>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div className="text-right pr-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Затраты</div>
                  <div className="font-bold text-emerald-600">{formatMoney(weekCost)}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-7 w-full divide-x divide-slate-100">
              {dates.map((date, idx) => {
                const isToday = date === todayDate;
                const allDayShifts = data.currentWeek?.shifts?.filter((s) => String(s.shiftDate).slice(0, 10) === date) || [];
                const dayShifts = isEmployee ? allDayShifts.filter((s) => s.userId === user?.id) : allDayShifts;
                const dayCost = calcCost(dayShifts);

                return (
                  <div key={date} className={`p-2 flex flex-col min-h-[140px] transition-colors ${isToday ? "bg-brand-50/30" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between text-[11px] whitespace-nowrap mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isToday ? "text-brand-700" : "text-slate-900"}`}>{parseInt(date.slice(8), 10)}</span>
                        <span className="text-slate-400 font-medium">{WEEKDAYS_RU[idx]}</span>
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 mb-2 font-medium">
                      {dayShifts.length} см. • {new Intl.NumberFormat("ru-RU").format(dayCost)} ₽
                    </div>

                    <div className="relative flex-1 bg-slate-50 rounded-sm border border-slate-100 p-1 overflow-hidden">
                      <div className="relative w-full h-full flex flex-col gap-1 items-start pt-1">
                        {dayShifts.map((s, i) => {
                          let startPct = timeToPercent(s.startTime);
                          let endPct = timeToPercent(s.endTime);
                          if (endPct <= startPct) endPct = 100;
                          return (
                            <div key={i} className="relative w-full h-1.5 shrink-0">
                              <div className="absolute inset-y-0 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors" style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 1)}%` }} title={`${s.startTime}–${s.endTime}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">Текущая неделя не найдена. <button onClick={() => navigate("/weeks")} className="text-brand-600 underline">Перейти в недели</button>.</div>
        )}

        <div className={isEmployee ? "flex flex-col gap-4" : "flex flex-col lg:flex-row gap-6 flex-1"}>
          
          {/* ТЕКУЩИЙ ДЕНЬ */}
          <div onClick={handleGoToToday} className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:border-brand-300 transition-all flex flex-col min-w-0 ${isEmployee ? "shrink-0" : "flex-1"}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  Сегодня, {dayLabel(todayDate)}
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{shortDate(todayDate)}</span>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Смен</div>
                  <div className="font-bold text-slate-900 text-sm">{todayShiftsToShow.length}</div>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Затраты</div>
                  <div className="font-bold text-emerald-600 text-sm">{formatMoney(todayCost)}</div>
                </div>
              </div>
            </div>

            {/* БАННЕР СТАТУСА */}
            <div className="h-10 mb-2 flex items-center justify-center transition-all">
              {hoveredShift && (
                <div className={`animate-fade-in flex items-center gap-2 px-5 py-2 rounded-full border shadow-sm ${
                  hasViolation 
                    ? "bg-rose-50 border-rose-200" 
                    : "bg-emerald-50 border-emerald-200"
                }`}>
                  <span className="text-sm font-bold tracking-wide flex items-center gap-2">
                    {lateness > 0 && <span className="text-rose-700">Опоздание: {lateness} мин</span>}
                    {lateness > 0 && (early > 0 || hoveredOvertime > 0) && <span className="text-rose-300">|</span>}
                    
                    {early > 0 && <span className="text-rose-700">Ранний уход: {early} мин</span>}
                    {early > 0 && hoveredOvertime > 0 && <span className="text-rose-300">|</span>}
                    
                    {hoveredOvertime > 0 && <span className="text-emerald-600">Переработка: {overtimeText}</span>}
                    
                    {lateness === 0 && early === 0 && hoveredOvertime === 0 && (
                      <span className="text-emerald-700">Приход вовремя</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className={`relative overflow-x-auto overflow-y-hidden ${isEmployee ? "min-h-[220px]" : "flex-1 min-h-[400px]"}`}>
              <div className="min-w-[800px] h-full flex flex-col relative">
                <div className="absolute inset-0 pointer-events-none z-0">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${(i / 24) * 100}%` }} />
                  ))}
                  <div className="absolute top-0 bottom-0 bg-slate-900/5 left-0" style={{ width: `${currentTimePercent}%` }} />
                  <div className="absolute top-0 bottom-0 bg-red-500 w-0.5 z-20" style={{ left: `${currentTimePercent}%` }} />
                </div>

                <div className={`relative shrink-0 z-10 w-full mb-1 ${isEmployee ? "h-8" : "h-14"}`}>
                  {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
                    let alignClass = "-translate-x-1/2";
                    if (h === 0) alignClass = "translate-x-0";
                    if (h === 24) alignClass = "-translate-x-full";
                    return <div key={`h-${h}`} className={`absolute text-[11px] font-semibold text-slate-500 ${alignClass}`} style={{ left: `${(h / 24) * 100}%`, top: 0 }}>{h}:00</div>;
                  })}
                </div>

                <div className="flex-1 relative z-10">
                  {todayShiftsToShow.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full text-slate-400 relative z-20 ${isEmployee ? "py-6" : "py-12"}`}>
                      <CalendarX2 className={`mb-3 text-slate-300 ${isEmployee ? "w-8 h-8" : "w-12 h-12"}`} />
                      <p>{isEmployee ? "У вас сегодня нет смен" : "На сегодня смен нет"}</p>
                    </div>
                  ) : (
                    todayShiftsToShow.map((shift) => {
                      let startPct = timeToPercent(shift.startTime);
                      let endPct = timeToPercent(shift.endTime);
                      if (endPct <= startPct) endPct = 100;
                      const widthPct = Math.max(endPct - startPct, 1);
                      const endParts = shift.endTime.split(":").map(Number);
                      const isEnded = now.getHours() > endParts[0] || (now.getHours() === endParts[0] && now.getMinutes() > endParts[1]);
                      const startParts = shift.startTime.split(":").map(Number);
                      const isStarted = !isEnded && (now.getHours() > startParts[0] || (now.getHours() === startParts[0] && now.getMinutes() >= startParts[1]));

                      // Данные о дисциплине
                      const sLateness = shift.latenessMinutes || 0;
                      const sEarly = shift.earlyLeaveMinutes || 0;
                      const shiftDurationMinutes = calcHours(shift.startTime, shift.endTime) * 60;
                      const latenessPct = shiftDurationMinutes > 0 ? (sLateness / shiftDurationMinutes) * 100 : 0;
                      const earlyLeavePct = shiftDurationMinutes > 0 ? (sEarly / shiftDurationMinutes) * 100 : 0;

                      // Вычисляем переработку (зеленую зону)
                      let overtimeStartPct = 0;
                      let overtimeEndPct = 0;
                      
                      if (shift.templateStartTime && shift.templateEndTime) {
                        const sStart = timeToMins(shift.startTime);
                        const sEnd = timeToMins(shift.endTime);
                        const tStart = timeToMins(shift.templateStartTime);
                        const tEnd = timeToMins(shift.templateEndTime);

                        if (sStart < tStart) overtimeStartPct = ((tStart - sStart) / (24 * 60)) * 100;
                        if (sEnd > tEnd) overtimeEndPct = ((sEnd - tEnd) / (24 * 60)) * 100;
                      }

                      return (
                        <div 
                          key={shift.id} 
                          onMouseEnter={() => setHoveredShift(shift)}
                          onMouseLeave={() => setHoveredShift(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isEmployee) setDisciplineShift(shift);
                          }}
                          className={`flex items-center relative transition-colors ${isEmployee ? "h-12" : "h-14 hover:bg-slate-50/80 cursor-pointer hover:ring-2 hover:ring-amber-400 hover:z-30"}`}
                        >
                          <div className="w-40 shrink-0 pr-2 flex items-center gap-2 relative z-30 pointer-events-none">
                            
                            {/* АВАТАР С ТОЧКОЙ */}
                            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                                <UserCircle className="w-4 h-4 text-slate-500" />
                              </div>
                              <span 
                                className={`absolute -top-0.5 -right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${(sLateness > 0 || sEarly > 0) ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                title={(sLateness > 0 || sEarly > 0) ? "Есть нарушения" : "Все вовремя"} 
                              />
                            </div>

                            <div className="min-w-0 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                              <div className="text-xs font-semibold text-slate-900 truncate" title={shift.userName || ""}>{shift.userName}</div>
                              <div className="text-[10px] text-slate-500 truncate">{shift.userPosition || "Сотрудник"}</div>
                            </div>
                          </div>

                          {/* ПОЛОСА СМЕНЫ */}
                          <div 
                            className={`absolute rounded-md shadow-sm overflow-hidden z-10 flex items-center ${isEmployee ? "h-7 top-2.5" : "h-8 top-3"}`} 
                            style={{ left: `${startPct}%`, width: `${widthPct}%`, backgroundColor: isEnded ? "#cbd5e1" : shift.templateColor || "#3b82f6" }}
                          >
                            {/* Зона: Опоздание (слева, красная) */}
                            {sLateness > 0 && (
                              <div className="absolute left-0 top-0 bottom-0 bg-rose-600/90 border-r-2 border-rose-800 z-10" style={{ width: `${latenessPct}%` }} />
                            )}

                            {/* Зона: Переработка (слева, зеленая) */}
                            {overtimeStartPct > 0 && (
                              <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/90 border-r-2 border-emerald-700 z-10" style={{ width: `${overtimeStartPct}%` }} />
                            )}

                            {/* Зона: Ранний уход (справа, красная) */}
                            {sEarly > 0 && (
                              <div className="absolute right-0 top-0 bottom-0 bg-rose-600/90 border-l-2 border-rose-800 z-10" style={{ width: `${earlyLeavePct}%` }} />
                            )}

                            {/* Зона: Переработка (справа, зеленая) */}
                            {overtimeEndPct > 0 && (
                              <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/90 border-l-2 border-emerald-700 z-10" style={{ width: `${overtimeEndPct}%` }} />
                            )}

                            {/* Время смены */}
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-white truncate drop-shadow-md z-20">
                              {shift.startTime} – {shift.endTime}
                            </span>
                          </div>

                          <div className="w-28 shrink-0 pl-2 text-right relative z-30 ml-auto pointer-events-none">
                            <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded inline-block">
                              {isEnded ? <span className="text-[10px] font-medium text-slate-400">Окончена</span> : isStarted ? <span className="text-[10px] font-medium text-emerald-600 flex items-center justify-end gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />В работе</span> : <span className="text-[10px] font-medium text-brand-600">Ожидается</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ */}
          {isEmployee ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Clock} label="Смена сегодня" value={formatHours(plannedToday)} />
              <StatCard icon={Timer} label="Отработано сегодня" value={formatHours(actualToday)} highlight />
              <StatCard icon={CalendarDays} label="Часов на неделе" value={formatHours(plannedWeek)} />
              <StatCard icon={Activity} label="Отработано за неделю" value={formatHours(actualWeek)} highlight />
              
              <StatCard icon={Banknote} label="Заработает за неделю" value={formatMoney(plannedWeek * hourlyRate)} />
              <StatCard icon={Wallet} label="Заработано" value={formatMoney(actualWeek * hourlyRate)} highlight />
              <div className="col-span-2">
                <StatCard icon={UserCircle} label="Текущий статус" value={statusText} alert={statusText === "Ожидается"} highlight={isWorking} />
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-80 shrink-0 grid grid-cols-2 gap-3 auto-rows-max">
              <StatCard 
                icon={Timer} 
                label="В работе" 
                value={todayShiftsToShow.filter(s => {
                  const end = s.endTime.split(":").map(Number);
                  const nowMins = now.getHours() * 60 + now.getMinutes();
                  const endMins = end[0] * 60 + end[1];
                  return nowMins < endMins;
                }).length || 0} 
                highlight 
              />
              <StatCard icon={ArrowRightLeft} label="Обмены" value={swapsIncoming} onClick={() => navigate("/swaps")} />
              <StatCard icon={AlertCircle} label="Запросы" value={vacationsPending + shiftChangesIncoming} onClick={() => navigate("/vacations")} alert={(vacationsPending + shiftChangesIncoming) > 0} />
              <StatCard icon={FileEdit} label="Ред. смены" value={shiftChangesIncoming} onClick={() => navigate("/weeks")} />
              
              <div className="col-span-2 grid grid-cols-2 gap-3">
                 <StatCard icon={CalendarDays} label="Смен за месяц" value={monthShiftsCount} />
                 <StatCard icon={Wallet} label="Затраты за месяц" value={formatMoney(monthCost)} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* МОДАЛКА ДИСЦИПЛИНЫ */}
      {disciplineShift && (
        <DisciplineModal 
          shift={disciplineShift} 
          onClose={() => setDisciplineShift(null)} 
          onSave={async () => {
            const res = await dashboardApi.summary();
            setData(res);
          }} 
        />
      )}
    </div>
  );
}

function DisciplineModal({ shift, onClose, onSave }: any) {
  const [lateness, setLateness] = useState(shift.latenessMinutes || 0);
  const [earlyLeave, setEarlyLeave] = useState(shift.earlyLeaveMinutes || 0);
  const [busy, setBusy] = useState(false);

  // Считаем переработку для этой конкретной смены
  let overtimeMins = 0;
  if (shift.templateStartTime && shift.templateEndTime) {
    const sStart = timeToMins(shift.startTime);
    const sEnd = timeToMins(shift.endTime);
    const tStart = timeToMins(shift.templateStartTime);
    const tEnd = timeToMins(shift.templateEndTime);

    if (sStart < tStart) overtimeMins += (tStart - sStart);
    if (sEnd > tEnd) overtimeMins += (sEnd - tEnd);
  }

  const handleSave = async () => {
    setBusy(true);
    try {
      // Отправляем только опоздание и ранний уход
      await shiftsApi.update(shift.id, { 
        latenessMinutes: lateness, 
        earlyLeaveMinutes: earlyLeave,
      });
      await onSave();
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Дисциплина</h3>
              <p className="text-xs text-slate-500">{shift.userName} · {shift.startTime}–{shift.endTime}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Опоздание (мин)</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setLateness(m)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${lateness === m ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {m === 0 ? "Нет" : `До ${m}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ранний уход (мин)</label>
            {overtimeMins > 0 ? (
              <p className="text-xs text-rose-500 mb-2 font-medium">Нельзя указать ранний уход при наличии переработки.</p>
            ) : (
              <p className="text-xs text-slate-400 mb-2">Доступно только если нет переработки.</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 15, 30, 60].map(m => (
                <button 
                  key={m} 
                  onClick={() => setEarlyLeave(m)} 
                  disabled={overtimeMins > 0 && m > 0}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    earlyLeave === m ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } ${overtimeMins > 0 && m > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {m === 0 ? "Нет" : `До ${m}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-8">
          <button onClick={handleSave} disabled={busy} className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-all shadow-sm">
            {busy ? "Сохранение..." : "Сохранить"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors">Отмена</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, onClick, highlight, alert }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
        onClick ? "hover:shadow-md hover:border-slate-300" : ""
      } ${
        highlight
          ? "bg-emerald-50 border-emerald-200"
          : alert
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
          highlight
            ? "bg-emerald-100 text-emerald-600"
            : alert
            ? "bg-amber-100 text-amber-600"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-900 leading-tight">{value}</div>
    </button>
  );
}