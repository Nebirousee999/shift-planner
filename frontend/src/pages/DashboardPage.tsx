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
} from "lucide-react";
import { dashboardApi, type DashboardSummary } from "../api/dashboard";
import { meApi, type MyProfile } from "../api/me";
import { useAuth } from "../store/auth";
import NavBar from "../components/NavBar";
import { shortDate, dayLabel, weekDates } from "../lib/dates";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function timeToPercent(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m < 0) m += 24 * 60;
  return m / 60;
}

function shiftProgressHours(
  shift: { startTime: string; endTime: string; shiftDate?: string | Date | null },
  now: Date
): number {
  const todayStr = now.toISOString().slice(0, 10);
  const dateStr = shift.shiftDate
    ? String(shift.shiftDate).slice(0, 10)
    : todayStr;

  if (dateStr < todayStr) return hoursBetween(shift.startTime, shift.endTime);
  if (dateStr > todayStr) return 0;

  const [sh, sm] = shift.startTime.split(":").map(Number);
  const [eh, em] = shift.endTime.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;

  if (nowMin < startMin) return 0;
  if (nowMin >= endMin) return (endMin - startMin) / 60;
  return (nowMin - startMin) / 60;
}

function formatHours(h: number): string {
  if (!h || h === 0) return "0 ч";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins} мин`;
  if (mins === 0) return `${hours} ч`;
  return `${hours} ч ${mins} м`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
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
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([dashboardApi.summary(), meApi.profile().catch(() => null)])
      .then(([dash, prof]) => {
        setData(dash);
        setProfile(prof);
      })
      .catch(() => alert("Ошибка загрузки дашборда"))
      .finally(() => setLoading(false));
  }, []);

  const todayDate = now.toISOString().slice(0, 10);
  const currentTimePercent =
    ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  const isEmployee = user?.role === "EMPLOYEE";

  const dates = data?.currentWeek ? weekDates(data.currentWeek.weekStartDate) : [];

  const handleGoToToday = () => {
    if (isEmployee) {
      navigate("/my");
      return;
    }
    if (data?.currentWeek?.id) navigate(`/weeks/${data.currentWeek.id}`);
    else navigate("/weeks");
  };

  // ─── Статистика для сотрудника ───
  const hourlyRate = profile?.hourlyRate ? Number(profile.hourlyRate) : 0;

  const myShiftsToday =
    data?.todayShifts?.filter((s) => s.userId === user?.id) || [];
  const myShiftsWeek =
    data?.currentWeek?.shifts?.filter((s) => s.userId === user?.id) || [];

  const myEntriesToday =
    data?.weekTimeEntries?.filter(
      (te) =>
        te.userId === user?.id &&
        String(te.clockIn).slice(0, 10) === todayDate
    ) || [];

  const plannedToday = myShiftsToday.reduce(
    (acc, s) => acc + hoursBetween(s.startTime, s.endTime),
    0
  );
  const plannedWeek = myShiftsWeek.reduce(
    (acc, s) => acc + hoursBetween(s.startTime, s.endTime),
    0
  );

  const actualToday = myShiftsToday.reduce(
    (sum, s) => sum + shiftProgressHours(s, now),
    0
  );
  const actualWeek = myShiftsWeek.reduce(
    (sum, s) => sum + shiftProgressHours(s, now),
    0
  );

  const plannedEarningsWeek = plannedWeek * hourlyRate;
  const actualEarningsWeek = actualWeek * hourlyRate;

  let statusText = "Нет смен";
  let isWorking = false;

  if (myShiftsToday.length > 0) {
    const activeEntry = myEntriesToday.find((te) => !te.clockOut);
    const shift = myShiftsToday[0];
    const endParts = shift.endTime.split(":").map(Number);
    const isEnded =
      now.getHours() > endParts[0] ||
      (now.getHours() === endParts[0] && now.getMinutes() > endParts[1]);
    const startParts = shift.startTime.split(":").map(Number);
    const isStarted =
      now.getHours() > startParts[0] ||
      (now.getHours() === startParts[0] &&
        now.getMinutes() >= startParts[1]);

    if (activeEntry) {
      statusText = "В работе";
      isWorking = true;
    } else if (isEnded) {
      statusText = "Смена окончена";
    } else if (isStarted) {
      statusText = "В работе";
      isWorking = true;
    } else {
      statusText = "Ожидается";
    }
  }

  const todayShiftsToShow = isEmployee
    ? myShiftsToday
    : data?.todayShifts || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* ═══ 1. ВЕРХНЯЯ ПАНЕЛЬ (Мини-календарь недели) ═══ */}
        {data?.currentWeek ? (
          <button
            onClick={() => navigate(isEmployee ? "/my" : "/weeks")}
            className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left hover:shadow-md hover:border-brand-300 transition-all flex flex-col group"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  {MONTHS_RU[
                    new Date(
                      data.currentWeek.weekStartDate + "T00:00:00Z"
                    ).getUTCMonth()
                  ]}{" "}
                  {new Date(
                    data.currentWeek.weekStartDate + "T00:00:00Z"
                  ).getUTCFullYear()}
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ring-1 ${
                    STATUS_COLORS[data.currentWeek.status]
                  }`}
                >
                  {STATUS_LABELS[data.currentWeek.status]}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
            </div>

            <div className="grid grid-cols-7 w-full divide-x divide-slate-100">
              {dates.map((date, idx) => {
                const isToday = date === todayDate;
                const allDayShifts =
                  data.currentWeek?.shifts.filter(
                    (s) => String(s.shiftDate).slice(0, 10) === date
                  ) || [];
                const dayShifts = isEmployee
                  ? allDayShifts.filter((s) => s.userId === user?.id)
                  : allDayShifts;

                return (
                  <div
                    key={date}
                    className={`p-2 flex flex-col min-h-[140px] transition-colors ${
                      isToday ? "bg-brand-50/30" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] whitespace-nowrap mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            isToday ? "text-brand-700" : "text-slate-900"
                          }`}
                        >
                          {parseInt(date.slice(8), 10)}
                        </span>
                        <span className="text-slate-400 font-medium">
                          {WEEKDAYS_RU[idx]}
                        </span>
                      </div>
                      <span className="text-slate-500 font-medium">
                        {dayShifts.length} см.
                      </span>
                    </div>

                    <div className="relative flex-1 bg-slate-50 rounded-sm border border-slate-100 p-1 overflow-hidden">
                      <div className="absolute inset-0 flex pointer-events-none opacity-20">
                        <div className="w-1/4 border-r border-slate-400" />
                        <div className="w-1/4 border-r border-slate-400" />
                        <div className="w-1/4 border-r border-slate-400" />
                        <div className="w-1/4" />
                      </div>
                      <div className="relative w-full h-full flex flex-col gap-1 items-start pt-1">
                        {dayShifts.map((s, i) => {
                          let startPct = timeToPercent(s.startTime);
                          let endPct = timeToPercent(s.endTime);
                          if (endPct <= startPct) endPct = 100;
                          const widthPct = Math.max(endPct - startPct, 1);

                          return (
                            <div
                              key={i}
                              className="relative w-full h-1.5 shrink-0"
                            >
                              <div
                                className="absolute inset-y-0 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors"
                                style={{
                                  left: `${startPct}%`,
                                  width: `${widthPct}%`,
                                }}
                                title={`${s.startTime}–${s.endTime}`}
                              />
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
            Текущая неделя не найдена.{" "}
            <button
              onClick={() => navigate(isEmployee ? "/my" : "/weeks")}
              className="text-brand-600 underline"
            >
              {isEmployee ? "Открыть мой график" : "Перейти в недели"}
            </button>
            .
          </div>
        )}

        {/* ═══ 2. НИЖНЯЯ ЧАСТЬ ═══ */}
        <div className={isEmployee ? "flex flex-col gap-4" : "flex flex-col lg:flex-row gap-6 flex-1"}>
          
          {/* Текущий день */}
          <div
            onClick={handleGoToToday}
            className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:border-brand-300 transition-all flex flex-col min-w-0 ${
              isEmployee ? "shrink-0" : "flex-1"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  Сегодня, {dayLabel(todayDate)}
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {shortDate(todayDate)}
                  </span>
                </h2>
              </div>
              <span className="text-xs font-medium text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0">
                <CalendarDays className="w-3.5 h-3.5" />
                {isEmployee ? "Мой день" : "Редактировать день"}
              </span>
            </div>

            {/* ─── ТАЙМЛАЙН ─── */}
            {isEmployee ? (
              /* ─── ДЛЯ СОТРУДНИКА: 3 колонки, без скролла, на всю ширину ─── */
              <div className="relative w-full flex flex-col">
                {/* Шкала времени */}
                <div className="flex w-full border-b border-slate-100 pb-1 mb-1">
                  <div className="w-40 shrink-0" />
                  <div className="flex-1 relative h-7">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-slate-200"
                        style={{ left: `${(i / 24) * 100}%` }}
                      />
                    ))}
                    {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
                      let alignClass = "-translate-x-1/2";
                      if (h === 0) alignClass = "translate-x-0";
                      if (h === 24) alignClass = "-translate-x-full";
                      return (
                        <div
                          key={`h-${h}`}
                          className={`absolute text-[11px] font-semibold text-slate-500 top-0 ${alignClass}`}
                          style={{ left: `${(h / 24) * 100}%` }}
                        >
                          {h}:00
                        </div>
                      );
                    })}
                    {Array.from(
                      new Set(
                        todayShiftsToShow?.flatMap((s) => [s.startTime, s.endTime]) || []
                      )
                    )
                      .sort()
                      .map((t) => (
                        <div
                          key={`t-${t}`}
                          className="absolute text-[10px] font-bold text-brand-600 -translate-x-1/2 bg-white px-0.5 rounded-sm z-20 top-3"
                          style={{ left: `${timeToPercent(t)}%` }}
                        >
                          {t}
                        </div>
                      ))}
                  </div>
                  <div className="w-28 shrink-0" />
                </div>

                {/* Строки смен */}
                <div className="relative flex flex-col w-full min-h-[48px]">
                  <div className="absolute inset-0 flex pointer-events-none z-0">
                    <div className="w-40 shrink-0" />
                    <div className="flex-1 relative">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-slate-100"
                          style={{ left: `${(i / 24) * 100}%` }}
                        />
                      ))}
                      <div
                        className="absolute top-0 bottom-0 bg-slate-900/5 left-0"
                        style={{ width: `${currentTimePercent}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 bg-red-500 w-0.5 z-20"
                        style={{ left: `${currentTimePercent}%` }}
                      />
                    </div>
                    <div className="w-28 shrink-0" />
                  </div>

                  {todayShiftsToShow.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-4 z-10 w-full">
                      <CalendarX2 className="w-8 h-8 mb-1 text-slate-300" />
                      <p className="text-sm">У вас сегодня нет смен</p>
                    </div>
                  ) : (
                    todayShiftsToShow.map((shift) => {
                      let startPct = timeToPercent(shift.startTime);
                      let endPct = timeToPercent(shift.endTime);
                      if (endPct <= startPct) endPct = 100;
                      const widthPct = Math.max(endPct - startPct, 1);

                      const endParts = shift.endTime.split(":").map(Number);
                      const isEnded =
                        now.getHours() > endParts[0] ||
                        (now.getHours() === endParts[0] && now.getMinutes() > endParts[1]);
                      const startParts = shift.startTime.split(":").map(Number);
                      const isStarted =
                        !isEnded &&
                        (now.getHours() > startParts[0] ||
                          (now.getHours() === startParts[0] && now.getMinutes() >= startParts[1]));

                      return (
                        <div
                          key={shift.id}
                          className="flex items-center h-12 relative hover:bg-slate-50/50 z-10 group"
                        >
                          <div className="w-40 shrink-0 pr-2 flex items-center gap-2 relative z-30 pointer-events-none">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <UserCircle className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="min-w-0 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                              <div className="text-xs font-semibold text-slate-900 truncate" title={shift.userName || ""}>
                                {shift.userName}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {shift.userPosition || "Сотрудник"}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 relative h-full">
                            <div
                              className="absolute rounded-md shadow-sm flex items-center px-2 overflow-hidden z-10 h-7 top-2.5"
                              style={{
                                left: `${startPct}%`,
                                width: `${widthPct}%`,
                                backgroundColor: isEnded
                                  ? "#cbd5e1"
                                  : shift.templateColor || "#3b82f6",
                              }}
                            >
                              <span className="text-[10px] font-medium text-white truncate drop-shadow-md">
                                {shift.startTime} – {shift.endTime}
                              </span>
                            </div>
                          </div>

                          <div className="w-28 shrink-0 pl-2 text-right relative z-30 pointer-events-none">
                            <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded inline-block">
                              {isEnded ? (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Окончена
                                </span>
                              ) : isStarted ? (
                                <span className="text-[10px] font-medium text-emerald-600 flex items-center justify-end gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  В работе
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-brand-600">
                                  Ожидается
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* ─── ДЛЯ МЕНЕДЖЕРА: БЕЗ СКРОЛЛА, ТАЙМЛАЙН НА ВСЮ ШИРИНУ ─── */
              <div className="relative w-full min-h-[400px] flex flex-col">
                {/* СЕТКА И ЛИНИИ */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${(i / 24) * 100}%` }} />
                  ))}
                  <div className="absolute top-0 bottom-0 bg-slate-900/5 left-0" style={{ width: `${currentTimePercent}%` }} />
                  <div className="absolute top-0 bottom-0 bg-red-500 w-0.5 z-20" style={{ left: `${currentTimePercent}%` }} />
                </div>

                {/* ШКАЛА ВРЕМЕНИ */}
                <div className="relative h-14 shrink-0 z-10 w-full mb-1">
                  {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
                    let alignClass = "-translate-x-1/2";
                    if (h === 0) alignClass = "translate-x-0";
                    if (h === 24) alignClass = "-translate-x-full";
                    return (
                      <div key={`h-${h}`} className={`absolute text-[11px] font-semibold text-slate-500 ${alignClass}`} style={{ left: `${(h / 24) * 100}%`, top: 0 }}>
                        {h}:00
                      </div>
                    );
                  })}

                  {Array.from(new Set(todayShiftsToShow?.flatMap(s => [s.startTime, s.endTime]) || [])).sort().map((t) => (
                    <div key={`t-${t}`} className="absolute text-[10px] font-bold text-brand-600 -translate-x-1/2 bg-white px-0.5 rounded-sm z-20" style={{ left: `${timeToPercent(t)}%`, top: 20 }}>
                      {t}
                    </div>
                  ))}
                </div>

                {/* СПИСОК СОТРУДНИКОВ */}
                <div className="flex-1 relative z-10">
                  {todayShiftsToShow.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 relative z-20">
                      <CalendarX2 className="w-12 h-12 mb-3 text-slate-300" />
                      <p>На сегодня смен нет</p>
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

                      return (
                        <div key={shift.id} className="flex items-center h-14 group relative hover:bg-slate-50/50 transition-colors">
                          <div className="w-40 shrink-0 pr-2 flex items-center gap-2 relative z-30 pointer-events-none">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <UserCircle className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="min-w-0 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
                              <div className="text-xs font-semibold text-slate-900 truncate" title={shift.userName || ""}>
                                {shift.userName}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {shift.userPosition || "Сотрудник"}
                              </div>
                            </div>
                          </div>

                          <div className="absolute h-8 rounded-md shadow-sm flex items-center px-2 overflow-hidden z-10 top-3" style={{ left: `${startPct}%`, width: `${widthPct}%`, backgroundColor: isEnded ? "#cbd5e1" : shift.templateColor || "#3b82f6" }}>
                            <span className="text-[10px] font-medium text-white truncate drop-shadow-md">
                              {shift.startTime} – {shift.endTime}
                            </span>
                          </div>

                          <div className="w-28 shrink-0 pl-2 text-right relative z-30 ml-auto pointer-events-none">
                            <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded inline-block">
                              {isEnded ? (
                                <span className="text-[10px] font-medium text-slate-400">Окончена</span>
                              ) : isStarted ? (
                                <span className="text-[10px] font-medium text-emerald-600 flex items-center justify-end gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  В работе
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-brand-600">Ожидается</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Статистика */}
          {isEmployee ? (
            /* ─── Сотрудник: сетка виджетов 4 колонки, ровно 2 ряда ─── */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Clock} label="Смена сегодня" value={formatHours(plannedToday)} />
              <StatCard icon={Timer} label="Отработано сегодня" value={formatHours(actualToday)} highlight />
              <StatCard icon={CalendarDays} label="Часов на неделе" value={formatHours(plannedWeek)} />
              <StatCard icon={Activity} label="Отработано за неделю" value={formatHours(actualWeek)} highlight />
              
              <StatCard icon={Banknote} label="Заработает за неделю" value={formatMoney(plannedEarningsWeek)} />
              <StatCard icon={Wallet} label="Заработано" value={formatMoney(actualEarningsWeek)} highlight />
              <div className="col-span-2">
                <StatCard
                  icon={UserCircle}
                  label="Текущий статус"
                  value={statusText}
                  alert={statusText === "Ожидается"}
                  highlight={isWorking}
                />
              </div>
            </div>
          ) : (
            /* ─── Менеджер: 6 виджетов справа ─── */
            <div className="w-full lg:w-80 shrink-0 grid grid-cols-2 gap-3 auto-rows-max">
              <StatCard icon={Users} label="Сотрудников" value={data?.userCount || 0} onClick={() => navigate("/team")} />
              <StatCard icon={Clock} label="Смен сегодня" value={data?.todayShifts?.length || 0} onClick={handleGoToToday} />
              <StatCard icon={Timer} label="В работе" value={data?.todayShifts?.filter((s) => {
                    const end = s.endTime.split(":").map(Number);
                    return now.getHours() < end[0] || (now.getHours() === end[0] && now.getMinutes() <= end[1]);
                  }).length || 0} highlight />
              <StatCard icon={CalendarDays} label="Недель" value={data?.currentWeek ? 1 : 0} onClick={() => navigate("/weeks")} />
              <StatCard icon={ArrowRightLeft} label="Обмены" value={0} onClick={() => navigate("/swaps")} />
              <StatCard icon={AlertCircle} label="Запросы" value={0} onClick={() => navigate("/vacations")} alert />
            </div>
          )}
        </div>
      </main>
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
      <div className="text-lg font-bold text-slate-900 leading-tight">
        {value}
      </div>
    </button>
  );
}