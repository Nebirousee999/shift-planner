import { useMemo, useState } from "react";
import {
  Plus,
  X,
  GripVertical,
  Trash2,
  Check,
  Calendar,
  Copy,
  ClipboardPaste,
  ClipboardX,
} from "lucide-react";

// ─── Seed data ─────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  position: string;
  color: string;
  rate: number; // Ставка в час
};

const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Мария", position: "продавец", color: "#3b82f6", rate: 500 },
  { id: "e2", name: "Иван", position: "повар", color: "#8b5cf6", rate: 600 },
  { id: "e3", name: "Анна", position: "официант", color: "#10b981", rate: 450 },
  { id: "e4", name: "Олег", position: "бариста", color: "#f59e0b", rate: 400 },
];

const DATES = ["20", "21", "22", "23", "24", "25", "26"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type DemoShift = {
  id: string;
  dayIndex: number;
  employeeId: string;
  startTime: string;
  endTime: string;
};

type ShiftTemplate = Omit<DemoShift, "id" | "dayIndex">;

type Clipboard =
  | { kind: "shift"; shift: ShiftTemplate }
  | { kind: "day"; shifts: ShiftTemplate[] }
  | null;

const INITIAL_SHIFTS: DemoShift[] = [
  { id: "s1", dayIndex: 0, employeeId: "e1", startTime: "09:00", endTime: "15:00" },
  { id: "s2", dayIndex: 0, employeeId: "e2", startTime: "12:00", endTime: "20:00" },
  { id: "s3", dayIndex: 1, employeeId: "e1", startTime: "09:00", endTime: "15:00" },
  { id: "s4", dayIndex: 2, employeeId: "e3", startTime: "14:00", endTime: "22:00" },
  { id: "s5", dayIndex: 3, employeeId: "e2", startTime: "12:00", endTime: "20:00" },
  { id: "s6", dayIndex: 4, employeeId: "e1", startTime: "10:00", endTime: "18:00" },
  { id: "s7", dayIndex: 4, employeeId: "e3", startTime: "14:00", endTime: "22:00" },
  { id: "s8", dayIndex: 5, employeeId: "e2", startTime: "10:00", endTime: "18:00" },
  { id: "s9", dayIndex: 5, employeeId: "e4", startTime: "08:00", endTime: "14:00" },
  { id: "s10", dayIndex: 6, employeeId: "e1", startTime: "12:00", endTime: "18:00" },
];

const calcHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
};

const calcCost = (start: string, end: string, rate: number) => {
  return Math.round(calcHours(start, end) * rate);
};

const fmtMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

let idCounter = 100;
const nextId = () => `s${idCounter++}`;

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function WeekDemo({ onInteract }: Props) {
  const [shifts, setShifts] = useState<DemoShift[]>(INITIAL_SHIFTS);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard>(null);

  const interact = () => onInteract?.();

  const stats = useMemo(() => {
    const totalShifts = shifts.length;
    const totalHours = shifts.reduce(
      (sum, s) => sum + calcHours(s.startTime, s.endTime),
      0
    );
    const totalCost = shifts.reduce((sum, s) => {
      const emp = EMPLOYEES.find((e) => e.id === s.employeeId);
      return sum + (emp ? calcCost(s.startTime, s.endTime, emp.rate) : 0);
    }, 0);
    return { shifts: totalShifts, hours: Math.round(totalHours), cost: totalCost };
  }, [shifts]);

  const byDay = useMemo(() => {
    const map = new Map<number, DemoShift[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const s of shifts) map.get(s.dayIndex)?.push(s);
    return map;
  }, [shifts]);

  // ─── Drag & Drop ─────────────────────────────────
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e: React.DragEvent, day: number) => {
    if (!draggingId) return;
    e.preventDefault();
    setDragOverDay(day);
  };

  const onDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!draggingId) return;
    const shift = shifts.find((s) => s.id === draggingId);
    if (!shift || shift.dayIndex === day) {
      setDraggingId(null);
      return;
    }
    setShifts((prev) =>
      prev.map((s) => (s.id === draggingId ? { ...s, dayIndex: day } : s))
    );
    setDraggingId(null);
    interact();
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverDay(null);
  };

  // ─── CRUD ────────────────────────────────────────
  const addShift = (
    dayIndex: number,
    employeeId: string,
    startTime: string,
    endTime: string
  ) => {
    setShifts((prev) => [
      ...prev,
      { id: nextId(), dayIndex, employeeId, startTime, endTime },
    ]);
    setAddingDay(null);
    interact();
  };

  const updateShift = (id: string, patch: Partial<DemoShift>) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setEditingId(null);
    interact();
  };

  const deleteShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
    interact();
  };

  // ─── Копирование / Вставка ───────────────────────
  const copyShift = (shift: DemoShift) => {
    const { id, dayIndex, ...rest } = shift;
    setClipboard({ kind: "shift", shift: rest });
    interact();
  };

  const copyDay = (dayIndex: number) => {
    const dayShifts = byDay.get(dayIndex) ?? [];
    if (dayShifts.length === 0) return;
    setClipboard({
      kind: "day",
      shifts: dayShifts.map(({ id, dayIndex, ...rest }) => rest),
    });
    interact();
  };

  const pasteShift = (dayIndex: number) => {
    if (!clipboard || clipboard.kind !== "shift") return;
    setShifts((prev) => [
      ...prev,
      { id: nextId(), dayIndex, ...clipboard.shift },
    ]);
    interact();
  };

  const pasteDay = (dayIndex: number) => {
    if (!clipboard || clipboard.kind !== "day") return;
    const newShifts = clipboard.shifts.map((s) => ({
      id: nextId(),
      dayIndex,
      ...s,
    }));
    setShifts((prev) => [...prev, ...newShifts]);
    interact();
  };

  const clearClipboard = () => setClipboard(null);

  const resetAll = () => {
    setShifts(INITIAL_SHIFTS);
    setEditingId(null);
    setAddingDay(null);
    setClipboard(null);
  };

  const clipboardLabel =
    clipboard?.kind === "shift"
      ? "1 смена"
      : clipboard?.kind === "day"
      ? `${clipboard.shifts.length} смен (день)`
      : null;

  return (
    <div className="bg-white rounded-xl">
      {/* Шапка */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            Неделя 20–26 октября
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {stats.shifts} смен · {stats.hours} ч
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
              Бюджет
            </div>
            <div className="text-base font-bold text-emerald-600 leading-none">
              {fmtMoney(stats.cost)}
            </div>
          </div>

          {clipboardLabel && (
            <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 font-medium">
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span className="hidden md:inline">В буфере: {clipboardLabel}</span>
              <span className="md:hidden">В буфере</span>
              <button
                onClick={clearClipboard}
                className="ml-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded p-0.5 transition-colors"
                title="Очистить буфер"
              >
                <ClipboardX className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Сетка */}
      <div className="-mx-1 overflow-x-auto pb-3">
        <div className="flex sm:grid sm:grid-cols-7 gap-2 sm:gap-3 px-1 w-max sm:w-auto sm:min-w-0 snap-x snap-mandatory">
          {DATES.map((date, i) => {
            const dayShifts = byDay.get(i) ?? [];
            const isOver = dragOverDay === i;
            const isWeekend = i >= 5;
            const canPaste = clipboard !== null;
            const hasShifts = dayShifts.length > 0;

            const dayCost = dayShifts.reduce((acc, s) => {
              const emp = EMPLOYEES.find((e) => e.id === s.employeeId);
              return acc + (emp ? calcCost(s.startTime, s.endTime, emp.rate) : 0);
            }, 0);

            return (
              <div
                key={i}
                onDragOver={(e) => onDragOver(e, i)}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => onDrop(e, i)}
                className={`w-[calc(50vw_-_1rem)] min-w-[140px] sm:min-w-0 sm:w-auto shrink-0 snap-start rounded-xl border-2 min-h-[340px] p-2.5 flex flex-col transition-all ${
                  isOver
                    ? "border-brand-400 bg-brand-50 ring-4 ring-brand-300/30"
                    : isWeekend
                    ? "border-slate-200 bg-slate-50/60"
                    : "border-slate-200 bg-white"
                }`}
              >
                {/* Шапка дня (только дата и кнопки) */}
                <div className="mb-2.5 pb-2 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-500">
                      {WEEKDAYS[i]}
                    </div>
                    <div
                      className={`text-lg sm:text-xl font-bold ${
                        isWeekend ? "text-violet-600" : "text-slate-900"
                      }`}
                    >
                      {date}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      type="button"
                      onClick={() => copyDay(i)}
                      disabled={!hasShifts}
                      className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded transition-colors"
                      title="Копировать все смены дня"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (clipboard?.kind === "shift") pasteShift(i);
                        else if (clipboard?.kind === "day") pasteDay(i);
                      }}
                      disabled={!canPaste}
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded transition-colors"
                      title={
                        clipboard?.kind === "shift"
                          ? "Вставить смену"
                          : clipboard?.kind === "day"
                          ? "Вставить все смены дня"
                          : "Вставить"
                      }
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Смены */}
                <div className="space-y-2 flex-1 min-w-0">
                  {dayShifts.map((s) => {
                    const emp = EMPLOYEES.find((e) => e.id === s.employeeId)!;
                    const isEditing = editingId === s.id;
                    const isDragging = draggingId === s.id;
                    const shiftCost = calcCost(s.startTime, s.endTime, emp.rate);

                    return (
                      <div
                        key={s.id}
                        draggable={!isEditing}
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => !isEditing && setEditingId(s.id)}
                        className={`group relative text-xs sm:text-sm rounded-lg p-2 border-l-4 transition-all ${
                          isEditing
                            ? "ring-2 ring-brand-400 bg-white shadow-md z-10"
                            : "cursor-pointer hover:ring-2 hover:ring-slate-300 hover:shadow-sm pr-14"
                        } ${isDragging ? "opacity-30" : ""}`}
                        style={{
                          backgroundColor: emp.color + "15",
                          borderLeftColor: emp.color,
                        }}
                      >
                        {isEditing ? (
                          <ShiftEditor
                            shift={s}
                            onChange={(patch) => updateShift(s.id, patch)}
                            onDelete={() => deleteShift(s.id)}
                            onCancel={() => setEditingId(null)}
                            onCopy={() => {
                              copyShift(s);
                              setEditingId(null);
                            }}
                          />
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-800 truncate">
                                {s.startTime}–{s.endTime}
                              </span>
                              <GripVertical className="w-3 h-3 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5" />
                            </div>
                            
                            <div className="text-slate-700 font-medium text-[11px] sm:text-xs truncate">
                              {emp.name}
                            </div>
                            
                            {/* Должность */}
                            <div className="text-slate-500 text-[9px] sm:text-[10px] truncate mt-0.5">
                              {emp.position}
                            </div>

                            {/* Стоимость (ниже должности) */}
                            <div className="text-slate-800 font-bold text-[10px] sm:text-[11px] mt-1 truncate">
                              {shiftCost} ₽
                            </div>

                            <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyShift(s);
                                }}
                                className="p-1 bg-white/90 backdrop-blur-sm rounded text-slate-500 hover:text-brand-600 hover:bg-white transition-colors shadow-sm"
                                title="Копировать смену"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteShift(s.id);
                                }}
                                className="p-1 bg-white/90 backdrop-blur-sm rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-sm"
                                title="Удалить смену"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {dayShifts.length === 0 && !addingDay && (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-300 select-none py-4">
                      —
                    </div>
                  )}
                </div>

                {/* Статистика дня (ВНИЗУ) */}
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  <span>{dayShifts.length} см.</span>
                  <span className="font-semibold text-slate-700">
                    {dayCost > 0 ? fmtMoney(dayCost) : "—"}
                  </span>
                </div>

                {/* Добавление */}
                {addingDay === i ? (
                  <AddShiftForm
                    onCancel={() => setAddingDay(null)}
                    onSubmit={(empId, start, end) => addShift(i, empId, start, end)}
                  />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingDay(i);
                    }}
                    className="mt-2 w-full text-xs text-slate-400 hover:text-brand-600 hover:bg-brand-50 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 border border-dashed border-slate-200 hover:border-brand-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    смена
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Подсказка + сброс */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Перетащите · кликните для редактирования · наведите — копировать
            или удалить
          </span>
          <span className="sm:hidden">💡 Свайпните, чтобы увидеть всю неделю</span>
        </div>
        <button
          onClick={resetAll}
          className="text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors"
        >
          Сбросить демо
        </button>
      </div>
    </div>
  );
}

// ─── Встроенный редактор смены ─────────────────────
function ShiftEditor({
  shift,
  onChange,
  onDelete,
  onCancel,
  onCopy,
}: {
  shift: DemoShift;
  onChange: (patch: Partial<DemoShift>) => void;
  onDelete: () => void;
  onCancel: () => void;
  onCopy: () => void;
}) {
  const [start, setStart] = useState(shift.startTime);
  const [end, setEnd] = useState(shift.endTime);

  return (
    <div className="space-y-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-1 min-w-0">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={start}
          onChange={(e) => setStart(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
          onBlur={() => setStart(normalizeTime(start))}
          className="!text-[10px] !px-0.5 !py-0.5 !w-full !min-w-0 !text-center !tracking-tight"
          aria-label="Начало"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={end}
          onChange={(e) => setEnd(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
          onBlur={() => setEnd(normalizeTime(end, "18:00"))}
          className="!text-[10px] !px-0.5 !py-0.5 !w-full !min-w-0 !text-center !tracking-tight"
          aria-label="Конец"
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onChange({ startTime: start, endTime: end })}
          className="flex-1 bg-brand-600 text-white py-1 rounded text-[11px] font-medium hover:bg-brand-700 flex items-center justify-center gap-0.5"
        >
          <Check className="w-3 h-3" />
          Готово
        </button>
        <button
          onClick={onCopy}
          className="px-1 py-1 text-slate-500 hover:bg-slate-100 rounded"
          title="Копировать"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="px-1 py-1 text-rose-600 hover:bg-rose-50 rounded"
          title="Удалить"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        <button
          onClick={onCancel}
          className="px-1 py-1 text-slate-400 hover:bg-slate-100 rounded"
          title="Отмена"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Форма добавления ─────────────────────────────
function AddShiftForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (empId: string, start: string, end: string) => void;
}) {
  const [empId, setEmpId] = useState(EMPLOYEES[0].id);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("15:00");

  return (
    <div
      className="mt-2 space-y-1.5 min-w-0"
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={empId}
        onChange={(e) => setEmpId(e.target.value)}
        className="!text-[11px] !px-1 !py-1 !w-full !min-w-0"
      >
        {EMPLOYEES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-1 min-w-0">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={start}
          onChange={(e) => setStart(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
          onBlur={() => setStart(normalizeTime(start))}
          className="!text-[10px] !px-0.5 !py-1 !w-full !min-w-0 !text-center !tracking-tight"
          aria-label="Начало"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={end}
          onChange={(e) => setEnd(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
          onBlur={() => setEnd(normalizeTime(end, "18:00"))}
          className="!text-[10px] !px-0.5 !py-1 !w-full !min-w-0 !text-center !tracking-tight"
          aria-label="Конец"
        />
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => onSubmit(empId, start, end)}
          className="flex-1 bg-brand-600 text-white py-1 rounded text-[11px] font-medium hover:bg-brand-700"
        >
          Добавить
        </button>
        <button
          onClick={onCancel}
          className="px-1 py-1 text-slate-500 hover:bg-slate-100 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Хелпер нормализации времени
function normalizeTime(val: string, fallback = "09:00"): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length === 0) return fallback;

  let h: number;
  let m: number;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4).padEnd(2, "0"), 10);
  }
  if (isNaN(h)) h = 9;
  if (isNaN(m)) m = 0;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}