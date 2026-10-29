import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Vacation } from "../api/vacations";
import { useDragScroll } from "../hooks/useDragScroll";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const CELL_WIDTH = 36;
const ROW_HEIGHT = 44;
const USER_COL_WIDTH = 200;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getMonthDays(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);
  }
  return out;
}

function dayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function formatDateRU(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].toLowerCase()}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function avatarColor(id: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

function barColor(id: string): string {
  const colors = [
    "bg-blue-400", "bg-violet-400", "bg-emerald-400", "bg-amber-400",
    "bg-rose-400", "bg-cyan-400", "bg-indigo-400", "bg-pink-400",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Block = {
  vacation: Vacation;
  startIndex: number;
  endIndex: number;
  daysCount: number;
};

function blockFromRange(
  v: Vacation,
  start: string,
  end: string,
  days: string[]
): Block | null {
  if (days.length === 0) return null;
  const first = days[0];
  const last = days[days.length - 1];
  if (end < first || start > last) return null;

  const sIdx = start < first ? 0 : Math.max(0, days.indexOf(start));
  const eIdx = end > last ? days.length - 1 : days.indexOf(end);
  if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) return null;

  return {
    vacation: v,
    startIndex: sIdx,
    endIndex: eIdx,
    daysCount: eIdx - sIdx + 1,
  };
}

type DragMode = "move" | "resize-start" | "resize-end";

type DragRef = {
  vacationId: string;
  mode: DragMode;
  startX: number;
  originalStart: string;
  originalEnd: string;
  currentStart: string;
  currentEnd: string;
  moved: boolean;
} | null;

type DragPreview = {
  id: string;
  start: string;
  end: string;
} | null;

type Props = {
  users: { id: string; name: string }[];
  vacations: Vacation[];
  canEdit?: (v: Vacation) => boolean;
  onUpdate?: (
    id: string,
    payload: { startDate: string; endDate: string }
  ) => Promise<void>;
  onBarClick?: (v: Vacation) => void;
  /** Текст тултипа на полосе. Если не передан — стандартный. */
  barTooltip?: (v: Vacation) => string;
};

export default function VacationsGantt({
  users,
  vacations,
  canEdit = () => false,
  onUpdate,
  onBarClick,
  barTooltip,
}: Props) {
  const dragScroll = useDragScroll<HTMLDivElement>();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayStr = today.toISOString().slice(0, 10);

  const dragRef = useRef<DragRef>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;

      const deltaX = e.clientX - ds.startX;
      const deltaDays = Math.round(deltaX / CELL_WIDTH);

      let newStart = ds.originalStart;
      let newEnd = ds.originalEnd;

      if (ds.mode === "move") {
        newStart = addDays(ds.originalStart, deltaDays);
        newEnd = addDays(ds.originalEnd, deltaDays);
      } else if (ds.mode === "resize-start") {
        newStart = addDays(ds.originalStart, deltaDays);
        if (newStart > ds.originalEnd) newStart = ds.originalEnd;
      } else if (ds.mode === "resize-end") {
        newEnd = addDays(ds.originalEnd, deltaDays);
        if (newEnd < ds.originalStart) newEnd = ds.originalStart;
      }

      if (newStart !== ds.currentStart || newEnd !== ds.currentEnd) {
        ds.currentStart = newStart;
        ds.currentEnd = newEnd;
        if (newStart !== ds.originalStart || newEnd !== ds.originalEnd) {
          ds.moved = true;
        }
        setDragPreview({ id: ds.vacationId, start: newStart, end: newEnd });
      }
    };

    const onUp = async () => {
      const ds = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (!ds) return;

      if (!ds.moved) {
        const vac = vacations.find((v) => v.id === ds.vacationId);
        if (vac && onBarClick) onBarClick(vac);
        return;
      }

      if (
        ds.currentStart === ds.originalStart &&
        ds.currentEnd === ds.originalEnd
      ) {
        return;
      }

      if (onUpdate) {
        try {
          await onUpdate(ds.vacationId, {
            startDate: ds.currentStart,
            endDate: ds.currentEnd,
          });
        } catch {
          /* ошибки обрабатывает вызывающий */
        }
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [vacations, onUpdate, onBarClick]);

  const onBarMouseDown = (
    e: React.MouseEvent,
    v: Vacation,
    mode: DragMode
  ) => {
    if (!canEdit(v)) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      vacationId: v.id,
      mode,
      startX: e.clientX,
      originalStart: v.startDate,
      originalEnd: v.endDate,
      currentStart: v.startDate,
      currentEnd: v.endDate,
      moved: false,
    };
    setDragPreview({ id: v.id, start: v.startDate, end: v.endDate });
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
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const rows = useMemo(() => {
    return users.map((u) => {
      const userVacations = vacations.filter((v) => v.userId === u.id);
      const blocks = userVacations
        .map((v) => blockFromRange(v, v.startDate, v.endDate, days))
        .filter((b): b is Block => b !== null);
      return { user: u, blocks };
    });
  }, [users, vacations, days]);

  // busyDays подсвечивает «день с отпуском/больничным» (общая колонка)
  const busyDays = useMemo(() => {
    const set = new Set<number>();
    for (const row of rows) {
      for (const b of row.blocks) {
        for (let i = b.startIndex; i <= b.endIndex; i++) set.add(i);
      }
    }
    return set;
  }, [rows]);

  const anyEditable = vacations.some((v) => canEdit(v));

  const defaultTooltip = (v: Vacation): string =>
    `${formatDateRU(v.startDate)} — ${formatDateRU(v.endDate)}${
      v.comment ? ` · ${v.comment}` : ""
    }`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Навигация по месяцам */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="font-semibold text-slate-900 min-w-[140px] text-center">
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
            Сегодня
          </button>
        </div>
      </div>

      {/* ═══════════ СЕТКА ═══════════ */}
      <div
        ref={dragScroll.ref}
        onMouseDown={dragScroll.onMouseDown}
        onMouseLeave={dragScroll.onMouseLeave}
        onMouseUp={dragScroll.onMouseUp}
        onMouseMove={dragScroll.onMouseMove}
        className={`overflow-auto max-h-[50vh] ${dragPreview ? "select-none" : ""}`}
        style={dragScroll.style}
      >
        <div
          className="relative"
          style={{ minWidth: USER_COL_WIDTH + days.length * CELL_WIDTH }}
        >
          {/* ─── Шапка: угол + дни ─── */}
          <div className="flex sticky top-0 z-30 bg-white">
            <div
              className="sticky left-0 z-40 bg-white border-r border-b border-slate-300 px-2 py-2 font-semibold text-xs text-slate-700 flex items-center"
              style={{ width: USER_COL_WIDTH, minWidth: USER_COL_WIDTH }}
            >
              Сотрудник
            </div>
            {days.map((d, i) => {
              const dow = dayOfWeek(d);
              const isWeekend = dow >= 5;
              const isToday = d === todayStr;
              return (
                <div
                  key={d}
                  className={`border-r border-b border-slate-300 text-center py-1 ${
                    isToday
                      ? "bg-brand-100 text-brand-700"
                      : isWeekend
                        ? "bg-slate-100 text-rose-600"
                        : "bg-white text-slate-600"
                  }`}
                  style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                >
                  <div className="text-[9px] opacity-70 leading-none">
                    {WEEKDAYS_SHORT[dow]}
                  </div>
                  <div
                    className={`text-[11px] leading-tight ${isToday ? "font-bold" : "font-semibold"}`}
                  >
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Строки сотрудников ─── */}
          {rows.map(({ user, blocks }) => (
            <div
              key={user.id}
              className="flex hover:bg-slate-50/40"
              style={{ height: ROW_HEIGHT }}
            >
              <div
                className="sticky left-0 z-20 bg-white border-r border-b border-slate-200 px-2 flex items-center gap-2"
                style={{
                  width: USER_COL_WIDTH,
                  minWidth: USER_COL_WIDTH,
                }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 ${avatarColor(user.id)}`}
                >
                  {initials(user.name)}
                </div>
                <span className="text-xs font-medium text-slate-900 truncate">
                  {user.name}
                </span>
              </div>

              <div
                className="relative flex"
                style={{ minWidth: days.length * CELL_WIDTH }}
              >
                {days.map((d, i) => {
                  const dow = dayOfWeek(d);
                  const isWeekend = dow >= 5;
                  const isToday = d === todayStr;
                  const hasVacation = busyDays.has(i);
                  return (
                    <div
                      key={d}
                      className={`border-r border-b border-slate-200 ${
                        isToday
                          ? "bg-brand-50"
                          : hasVacation
                            ? "bg-amber-50/60"
                            : isWeekend
                              ? "bg-slate-50"
                              : ""
                      }`}
                      style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                    />
                  );
                })}

                {blocks.map((b) => {
                  const preview =
                    dragPreview?.id === b.vacation.id ? dragPreview : null;
                  const previewBlock = preview
                    ? blockFromRange(b.vacation, preview.start, preview.end, days)
                    : null;
                  const rendered = previewBlock ?? b;
                  const editable = canEdit(b.vacation);

                  return (
                    <div
                      key={b.vacation.id}
                      onMouseDown={(e) =>
                        editable && onBarMouseDown(e, b.vacation, "move")
                      }
                      onClick={() => {
                        if (!editable && onBarClick) onBarClick(b.vacation);
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-md shadow-sm text-white text-[11px] font-medium flex items-center px-2 select-none overflow-hidden ${barColor(b.vacation.id)} ${
                        editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                      }`}
                      style={{
                        left: rendered.startIndex * CELL_WIDTH + 2,
                        width: rendered.daysCount * CELL_WIDTH - 4,
                      }}
                      title={
                        barTooltip
                          ? barTooltip(b.vacation)
                          : defaultTooltip(b.vacation)
                      }
                    >
                      {editable && (
                        <>
                          <span
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onBarMouseDown(e, b.vacation, "resize-start");
                            }}
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                          />
                          <span
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onBarMouseDown(e, b.vacation, "resize-end");
                            }}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                          />
                        </>
                      )}
                      <span className="truncate">
                        {formatDateRU(rendered.vacation.startDate)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Нет сотрудников для отображения
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ Легенда ═══════════ */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-brand-100" />
          Сегодня
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-50 ring-1 ring-amber-200" />
          День с отпуском
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-100" />
          Выходной
        </div>
        {anyEditable && (
          <span className="ml-auto hidden md:inline text-slate-400">
            Тянуть — сдвинуть · За края — растянуть · Клик — открыть
          </span>
        )}
      </div>
    </div>
  );
}