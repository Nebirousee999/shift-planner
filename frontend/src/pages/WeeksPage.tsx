import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  CheckCircle2,
  FileEdit,
  Lock,
} from "lucide-react";
import { useWeeks } from "../store/weeks";
import { useShiftTemplates } from "../store/shiftTemplates";
import {
  shiftChangeRequestsApi,
  type ShiftChangeRequest,
} from "../api/shiftChangeRequests";
import NavBar from "../components/NavBar";

// ─── Утилиты ─────────────────────────────────────────
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildMonthWeeks(year: number, month: number): Date[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const start = getMonday(first);
  const end = new Date(last);
  const dow = end.getUTCDay();
  const tail = dow === 0 ? 0 : 7 - dow;
  end.setUTCDate(end.getUTCDate() + tail);

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type StatusMeta = {
  label: string;
  icon: React.ElementType;
  badge: string;
  bar: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: {
    label: "Черновик",
    icon: FileEdit,
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    bar: "bg-slate-300",
  },
  PUBLISHED: {
    label: "Опубликован",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  LOCKED: {
    label: "Заблокирован",
    icon: Lock,
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    bar: "bg-red-500",
  },
};

// ─── Мини-таймлайн смен ──────────────────────────────
function ShiftLines({
  shifts,
  templateColorById,
}: {
  shifts: { startTime: string; endTime: string; templateId: string | null }[];
  templateColorById: (id: string | null) => string;
}) {
  if (shifts.length === 0) return null;

  return (
    <div className="w-full mt-1 space-y-[3px]">
      {shifts.map((s, i) => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        const endFixed = end <= start ? 24 * 60 : end;
        const leftPct = (start / (24 * 60)) * 100;
        const widthPct = ((endFixed - start) / (24 * 60)) * 100;
        const color = templateColorById(s.templateId);
        return (
          <div key={i} className="relative w-full h-[4px]">
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 2)}%`,
                backgroundColor: color,
              }}
              title={`${s.startTime}–${s.endTime}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Компонент ───────────────────────────────────────
export default function WeeksPage() {
  const navigate = useNavigate();
  const { weeks, loading, error, fetchWeeks, createWeek } = useWeeks();
  const { items: templates, fetch: fetchTemplates } = useShiftTemplates();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());

  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState(today.toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());

  const todayStr = today.toISOString().slice(0, 10);

  useEffect(() => {
    fetchWeeks();
    fetchTemplates();
    Promise.all([
      shiftChangeRequestsApi.incoming().catch(() => []),
      shiftChangeRequestsApi.outgoing().catch(() => []),
    ]).then(([inc, out]) => {
      const set = new Set<string>();
      for (const r of [...inc, ...out]) {
        if (r.status !== "PENDING") continue;
        set.add(String(r.oldShiftDate).slice(0, 10));
        set.add(String(r.newShiftDate).slice(0, 10));
      }
      setPendingDates(set);
    });
  }, [fetchWeeks, fetchTemplates]);

  const calendarWeeks = useMemo(
    () => buildMonthWeeks(year, month),
    [year, month]
  );

  const weeksMap = useMemo(() => {
    const map = new Map<string, (typeof weeks)[number]>();
    for (const w of weeks) {
      map.set(String(w.weekStartDate).slice(0, 10), w);
    }
    return map;
  }, [weeks]);

  const templateColorById = (id: string | null): string => {
    if (!id) return "#94A3B8";
    return templates.find((t) => t.id === id)?.color ?? "#94A3B8";
  };

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
    setYear(today.getUTCFullYear());
    setMonth(today.getUTCMonth());
  };

  const onCreate = async () => {
    setCreating(true);
    try {
      const week = await createWeek(newDate);
      setShowForm(false);
      navigate(`/weeks/${week.id}`);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const onWeekClick = (weekStart: Date) => {
    const key = toDateStr(weekStart);
    const existing = weeksMap.get(key);
    if (existing) {
      navigate(`/weeks/${existing.id}`);
    } else {
      setNewDate(key);
      setShowForm(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Недели</h1>
            <p className="text-sm text-slate-500 mt-1">
              Нажмите на неделю — откроется график. Полоски под числами
              показывают смены. Янтарная точка — есть запрос на изменение.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Отмена
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Новая неделя
              </>
            )}
          </button>
        </div>

        {/* Форма создания */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-1">
              Создать новую неделю
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Любая дата будет приведена к понедельнику
            </p>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Дата недели
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="!w-48"
                />
              </div>
              <button
                onClick={onCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                {creating ? "Создание..." : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Навигация по месяцам */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-slate-900 min-w-[160px] text-center">
              {MONTHS_RU[month]} {year}
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
            >
              Сегодня
            </button>
          </div>
          <div className="text-xs text-slate-500">
            {calendarWeeks.length} недель в месяце
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Календарь */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Заголовки дней недели */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {WEEKDAYS_RU.map((d, i) => (
              <div
                key={d}
                className={`py-3 text-center text-xs font-medium uppercase tracking-wide ${
                  i >= 5 ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Недели */}
          {calendarWeeks.map((week) => {
            const weekStart = week[0];
            const key = toDateStr(weekStart);
            const existing = weeksMap.get(key);
            const meta = existing ? STATUS_META[existing.status] : null;
            const StatusIcon = meta?.icon;

            const hasToday = week.some((d) => toDateStr(d) === todayStr);

            const shiftsByDate = new Map<string, any[]>();
            for (const s of existing?.shifts ?? []) {
              const dateKey = String(s.shiftDate).slice(0, 10);
              if (!shiftsByDate.has(dateKey)) shiftsByDate.set(dateKey, []);
              shiftsByDate.get(dateKey)!.push(s);
            }

            return (
              <button
                key={key}
                onClick={() => onWeekClick(weekStart)}
                className={`w-full grid grid-cols-7 border-b border-slate-100 last:border-0 relative text-left transition-colors group ${
                  hasToday ? "bg-brand-50/40" : "hover:bg-slate-50/70"
                }`}
              >
                {/* Полоса статуса */}
                {meta && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`}
                  />
                )}

                {/* 7 ячеек с числами */}
                {week.map((d, i) => {
                  const dateStr = toDateStr(d);
                  const isToday = dateStr === todayStr;
                  const isWeekend = i >= 5;
                  const isOtherMonth = d.getUTCMonth() !== month;
                  const dayShifts = shiftsByDate.get(dateStr) ?? [];
                  const hasPendingRequest = pendingDates.has(dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`relative pt-2 px-1.5 pb-2 flex flex-col border-r border-slate-100 last:border-0 min-h-[78px] ${
                        isWeekend ? "bg-slate-50/40" : ""
                      }`}
                    >
                      {/* Точка в правом верхнем углу ячейки дня */}
                      {hasPendingRequest && (
                        <span
                          className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white z-10"
                          title="Есть запрос на изменение смены"
                        />
                      )}

                      <div className="flex items-center justify-center">
                        <div
                          className={`text-base font-semibold ${
                            isToday
                              ? "w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm"
                              : isOtherMonth
                              ? "text-slate-300"
                              : isWeekend
                              ? "text-slate-400"
                              : "text-slate-900"
                          }`}
                        >
                          {d.getUTCDate()}
                        </div>
                      </div>

                      {/* Мини-таймлайн смен */}
                      <ShiftLines
                        shifts={dayShifts}
                        templateColorById={templateColorById}
                      />

                      {/* Индикатор количества смен */}
                      {dayShifts.length > 0 && (
                        <div className="mt-auto pt-1 text-center text-[10px] text-slate-400">
                          {dayShifts.length}{" "}
                          {dayShifts.length === 1
                            ? "смена"
                            : dayShifts.length < 5
                            ? "смены"
                            : "смен"}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Статус-бейдж недели */}
                {meta && StatusIcon && (
                  <div className="absolute top-2 right-2 pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.badge}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  </div>
                )}

                {/* Хинт "Создать" */}
                {!existing && !hasToday && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-xs text-slate-500 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                      + Создать неделю
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Легенда */}
        <div className="flex items-center gap-4 mt-4 px-1 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-300" />
            Черновик
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            Опубликован
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            Заблокирован
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Запрос на изменение смены
          </div>
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-8 h-1 rounded-full bg-brand-500" />
            Полоска = смена
          </div>
        </div>

        {/* Пустое состояние */}
        {!loading && weeks.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center mt-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Пока нет ни одной недели
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Нажмите на любую неделю в календаре или создайте через кнопку
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              Создать первую неделю
            </button>
          </div>
        )}
      </main>
    </div>
  );
}