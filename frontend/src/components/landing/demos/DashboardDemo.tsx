import { useMemo, useState } from "react";
import {
  Clock,
  UserCircle,
  AlertTriangle,
  X,
  CalendarDays,
  Timer,
} from "lucide-react";

// ─── Данные ────────────────────────────────────────
type DemoShift = {
  id: string;
  employeeName: string;
  position: string;
  color: string;
  // Фактические часы
  startTime: string; // "HH:MM"
  endTime: string;
  // Шаблон (для расчёта переработки)
  templateStartTime: string;
  templateEndTime: string;
  templateName: string;
  // Дисциплина
  latenessMinutes: number;
  earlyLeaveMinutes: number;
};

const INITIAL_SHIFTS: DemoShift[] = [
  {
    id: "s1",
    employeeName: "Мария Иванова",
    position: "продавец",
    color: "#3b82f6",
    startTime: "09:00",
    endTime: "15:00",
    templateStartTime: "09:00",
    templateEndTime: "15:00",
    templateName: "Утренняя",
    latenessMinutes: 0,
    earlyLeaveMinutes: 0,
  },
  {
    id: "s2",
    employeeName: "Иван Петров",
    position: "повар",
    color: "#8b5cf6",
    startTime: "12:00",
    endTime: "21:00",
    templateStartTime: "12:00",
    templateEndTime: "20:00",
    templateName: "Дневная",
    latenessMinutes: 0,
    earlyLeaveMinutes: 0,
  },
  {
    id: "s3",
    employeeName: "Анна Сидорова",
    position: "официант",
    color: "#10b981",
    startTime: "14:15",
    endTime: "22:00",
    templateStartTime: "14:00",
    templateEndTime: "22:00",
    templateName: "Вечерняя",
    latenessMinutes: 15,
    earlyLeaveMinutes: 0,
  },
  {
    id: "s4",
    employeeName: "Олег Кузнецов",
    position: "бариста",
    color: "#f59e0b",
    startTime: "10:00",
    endTime: "17:30",
    templateStartTime: "10:00",
    templateEndTime: "18:00",
    templateName: "Дневная",
    latenessMinutes: 0,
    earlyLeaveMinutes: 30,
  },
];

// ─── Утилиты ───────────────────────────────────────
const timeToMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const timeToPercent = (t: string) => (timeToMins(t) / (24 * 60)) * 100;

// «Сейчас» для демо — 15:30
const NOW_MINUTES = 15 * 60 + 30;
const NOW_PERCENT = (NOW_MINUTES / (24 * 60)) * 100;

function formatMins(m: number): string {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${h} ч ${rest} м` : `${h} ч`;
}

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function DashboardDemo({ onInteract }: Props) {
  const [shifts, setShifts] = useState<DemoShift[]>(INITIAL_SHIFTS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DemoShift | null>(null);

  const interact = () => onInteract?.();

  const hoveredShift = shifts.find((s) => s.id === hoveredId) ?? null;

  // Расчёт переработки для ховера
  const hoveredInfo = useMemo(() => {
    if (!hoveredShift) return null;
    const sStart = timeToMins(hoveredShift.startTime);
    const sEnd = timeToMins(hoveredShift.endTime);
    const tStart = timeToMins(hoveredShift.templateStartTime);
    const tEnd = timeToMins(hoveredShift.templateEndTime);

    let overtime = 0;
    if (sStart < tStart) overtime += tStart - sStart;
    if (sEnd > tEnd) overtime += sEnd - tEnd;

    return {
      lateness: hoveredShift.latenessMinutes,
      earlyLeave: hoveredShift.earlyLeaveMinutes,
      overtime,
    };
  }, [hoveredShift]);

  const updateDiscipline = (
    id: string,
    lateness: number,
    earlyLeave: number
  ) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, latenessMinutes: lateness, earlyLeaveMinutes: earlyLeave }
          : s
      )
    );
    setEditing(null);
    interact();
  };

  const resetAll = () => {
    setShifts(INITIAL_SHIFTS);
    setHoveredId(null);
    setEditing(null);
  };

  return (
    <div className="bg-white rounded-xl">
      {/* Заголовок «Сегодня» */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            Сегодня, Пн
            <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              22 окт
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
              Смен
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {shifts.length}
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
              Сейчас
            </div>
            <div className="font-bold text-brand-600 text-sm">15:30</div>
          </div>
        </div>
      </div>

      {/* Баннер статуса при ховере */}
      <div className="h-11 mb-3 flex items-center justify-center transition-all">
        {hoveredShift && hoveredInfo && (
          <div
            className={`animate-fade-in flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${
              hoveredInfo.lateness > 0 || hoveredInfo.earlyLeave > 0
                ? "bg-rose-50 border-rose-200"
                : "bg-emerald-50 border-emerald-200"
            }`}
          >
            <span className="text-sm font-bold tracking-wide flex items-center gap-2 flex-wrap">
              {hoveredInfo.lateness > 0 && (
                <span className="text-rose-700">
                  Опоздание: {hoveredInfo.lateness} мин
                </span>
              )}
              {hoveredInfo.lateness > 0 &&
                (hoveredInfo.earlyLeave > 0 || hoveredInfo.overtime > 0) && (
                  <span className="text-rose-300">|</span>
                )}
              {hoveredInfo.earlyLeave > 0 && (
                <span className="text-rose-700">
                  Ранний уход: {hoveredInfo.earlyLeave} мин
                </span>
              )}
              {hoveredInfo.earlyLeave > 0 && hoveredInfo.overtime > 0 && (
                <span className="text-rose-300">|</span>
              )}
              {hoveredInfo.overtime > 0 && (
                <span className="text-emerald-600">
                  Переработка: {formatMins(hoveredInfo.overtime)}
                </span>
              )}
              {hoveredInfo.lateness === 0 &&
                hoveredInfo.earlyLeave === 0 &&
                hoveredInfo.overtime === 0 && (
                  <span className="text-emerald-700">Приход вовремя</span>
                )}
            </span>
          </div>
        )}
      </div>

      {/* Таймлайн */}
      <div className="relative overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200">
        <div className="min-w-[800px] bg-white">
          {/* Шкала часов */}
          <div className="relative h-8 border-b border-slate-100 bg-slate-50/50">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
              let alignClass = "-translate-x-1/2";
              if (h === 0) alignClass = "translate-x-0";
              if (h === 24) alignClass = "-translate-x-full";
              return (
                <div
                  key={h}
                  className={`absolute text-[10px] font-semibold text-slate-500 ${alignClass}`}
                  style={{ left: `${(h / 24) * 100}%`, top: "50%", transform: `translateY(-50%) ${alignClass === "-translate-x-1/2" ? "translateX(-50%)" : alignClass === "-translate-x-full" ? "translateX(-100%)" : ""}` }}
                >
                  {h}:00
                </div>
              );
            })}
          </div>

          {/* Сетка + смены */}
          <div className="relative min-h-[280px]">
            {/* Вертикальные линии + "сейчас" */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-slate-100"
                  style={{ left: `${(i / 24) * 100}%` }}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 bg-slate-900/5 left-0"
                style={{ width: `${NOW_PERCENT}%` }}
              />
              <div
                className="absolute top-0 bottom-0 bg-rose-500 w-0.5 z-20"
                style={{ left: `${NOW_PERCENT}%` }}
              />
            </div>

            {/* Смены */}
            <div className="relative z-10 pt-3">
              {shifts.map((shift) => {
                const startPct = timeToPercent(shift.startTime);
                const endPct = timeToPercent(shift.endTime);
                const widthPct = Math.max(endPct - startPct, 1);

                // Внутренние зоны — в процентах от длины полосы
                const totalMins =
                  timeToMins(shift.endTime) - timeToMins(shift.startTime);
                const latenessPct =
                  totalMins > 0
                    ? (shift.latenessMinutes / totalMins) * 100
                    : 0;
                const earlyPct =
                  totalMins > 0
                    ? (shift.earlyLeaveMinutes / totalMins) * 100
                    : 0;

                // Переработка
                const sStart = timeToMins(shift.startTime);
                const sEnd = timeToMins(shift.endTime);
                const tStart = timeToMins(shift.templateStartTime);
                const tEnd = timeToMins(shift.templateEndTime);
                const overtimeStartMins = Math.max(0, tStart - sStart);
                const overtimeEndMins = Math.max(0, sEnd - tEnd);
                const overtimeStartPct =
                  totalMins > 0 ? (overtimeStartMins / totalMins) * 100 : 0;
                const overtimeEndPct =
                  totalMins > 0 ? (overtimeEndMins / totalMins) * 100 : 0;

                const isEnded = timeToMins(shift.endTime) < NOW_MINUTES;
                const isStarted =
                  timeToMins(shift.startTime) <= NOW_MINUTES && !isEnded;

                return (
                  <div
                    key={shift.id}
                    className="relative h-14 mb-1"
                    onMouseEnter={() => setHoveredId(shift.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Имя слева */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 flex items-center gap-2 pointer-events-none z-30 pr-1">
                      {/* На самом деле, лучше вынести имя вне полосы — сделаем абсолютно слева */}
                    </div>

                    {/* Полоса смены */}
                    <div
                      onClick={() => {
                        setEditing(shift);
                        interact();
                      }}
                      className={`absolute rounded-md shadow-sm overflow-hidden z-10 flex items-center cursor-pointer hover:ring-2 hover:ring-amber-400 hover:shadow-lg transition-all ${
                        isEnded ? "opacity-80" : ""
                      }`}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        top: 8,
                        height: 40,
                        backgroundColor: isEnded
                          ? "#cbd5e1"
                          : shift.color,
                      }}
                    >
                      {/* Зона опоздания (слева) */}
                      {shift.latenessMinutes > 0 && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-rose-600/90 border-r-2 border-rose-800 z-10"
                          style={{ width: `${latenessPct}%` }}
                        />
                      )}

                      {/* Зона переработки (слева) */}
                      {overtimeStartPct > 0 && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-emerald-500/90 border-r-2 border-emerald-700 z-10"
                          style={{ width: `${overtimeStartPct}%` }}
                        />
                      )}

                      {/* Зона раннего ухода (справа) */}
                      {shift.earlyLeaveMinutes > 0 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-rose-600/90 border-l-2 border-rose-800 z-10"
                          style={{ width: `${earlyPct}%` }}
                        />
                      )}

                      {/* Зона переработки (справа) */}
                      {overtimeEndPct > 0 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-emerald-500/90 border-l-2 border-emerald-700 z-10"
                          style={{ width: `${overtimeEndPct}%` }}
                        />
                      )}

                      {/* Время внутри полосы */}
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white truncate drop-shadow-md z-20">
                        {shift.startTime}–{shift.endTime}
                      </span>
                    </div>

                    {/* Имя + аватар слева от полосы */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 z-30 pointer-events-none"
                      style={{ left: `${startPct}%`, transform: `translateY(-50%) translateX(-100%)`, paddingRight: 8 }}
                    >
                      <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-200 max-w-[160px]">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {shift.employeeName}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {shift.position}
                        </div>
                      </div>
                      <div className="relative w-8 h-8 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-slate-500" />
                        </div>
                        <span
                          className={`absolute -top-0.5 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                            shift.latenessMinutes > 0 ||
                            shift.earlyLeaveMinutes > 0
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                          }`}
                          title={
                            shift.latenessMinutes > 0 ||
                            shift.earlyLeaveMinutes > 0
                              ? "Есть нарушения"
                              : "Всё вовремя"
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Подсказка + сброс */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Наведите — увидите статус · кликните — поставьте опоздание или
            ранний уход
          </span>
          <span className="sm:hidden">💡 Кликните на смену</span>
        </div>
        <button
          onClick={resetAll}
          className="text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors"
        >
          Сбросить демо
        </button>
      </div>

      {/* Легенда */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-600" />
          Опоздание / ранний уход
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          Переработка
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
          Смена окончена
        </div>
      </div>

      {/* Модалка дисциплины */}
      {editing && (
        <DisciplineModal
          shift={editing}
          onClose={() => setEditing(null)}
          onSave={(lateness, earlyLeave) =>
            updateDiscipline(editing.id, lateness, earlyLeave)
          }
        />
      )}
    </div>
  );
}

// ─── Модалка ───────────────────────────────────────
function DisciplineModal({
  shift,
  onClose,
  onSave,
}: {
  shift: DemoShift;
  onClose: () => void;
  onSave: (lateness: number, earlyLeave: number) => void;
}) {
  const [lateness, setLateness] = useState(shift.latenessMinutes);
  const [earlyLeave, setEarlyLeave] = useState(shift.earlyLeaveMinutes);

  // Считаем переработку этой смены
  const sStart = timeToMins(shift.startTime);
  const sEnd = timeToMins(shift.endTime);
  const tStart = timeToMins(shift.templateStartTime);
  const tEnd = timeToMins(shift.templateEndTime);
  let overtimeMins = 0;
  if (sStart < tStart) overtimeMins += tStart - sStart;
  if (sEnd > tEnd) overtimeMins += sEnd - tEnd;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Дисциплина
              </h3>
              <p className="text-xs text-slate-500">
                {shift.employeeName} · {shift.startTime}–{shift.endTime}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Опоздание (мин)
            </label>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setLateness(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    lateness === m
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m === 0 ? "Нет" : `До ${m}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ранний уход (мин)
            </label>
            {overtimeMins > 0 ? (
              <p className="text-xs text-rose-500 mb-2 font-medium">
                Нельзя указать ранний уход при наличии переработки.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-2">
                Доступно только если нет переработки.
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => setEarlyLeave(m)}
                  disabled={overtimeMins > 0 && m > 0}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    earlyLeave === m
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } ${
                    overtimeMins > 0 && m > 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {m === 0 ? "Нет" : `До ${m}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-8">
          <button
            onClick={() => onSave(lateness, earlyLeave)}
            className="flex-1 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium transition-all shadow-sm"
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}