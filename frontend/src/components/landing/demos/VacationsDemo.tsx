import { useEffect, useMemo, useState } from "react";
import {
  Palmtree,
  Plus,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

// ─── Константы ─────────────────────────────────────
const CELL_WIDTH = 34;
const ROW_HEIGHT = 56;
const EMP_COL_WIDTH = 200;
const DAYS_IN_MONTH = 31;
const TODAY_DAY = 15;

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const getWeekdayShort = (day: number): string => {
  const d = new Date(2026, 9, day);
  const dow = d.getDay();
  const idx = dow === 0 ? 6 : dow - 1;
  return WEEKDAYS[idx];
};

const isWeekend = (day: number): boolean => {
  const d = new Date(2026, 9, day);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
};

// ─── Типы ──────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  position: string;
  color: string;
};

type Vacation = {
  id: string;
  employeeId: string;
  startDay: number;
  endDay: number;
  status: "approved" | "pending";
};

const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Мария Иванова", position: "продавец", color: "#3b82f6" },
  { id: "e2", name: "Иван Петров", position: "повар", color: "#8b5cf6" },
  { id: "e3", name: "Анна Сидорова", position: "официант", color: "#10b981" },
  { id: "e4", name: "Олег Кузнецов", position: "бариста", color: "#f59e0b" },
];

const INITIAL_VACATIONS: Vacation[] = [
  { id: "v1", employeeId: "e1", startDay: 5, endDay: 10, status: "approved" },
  { id: "v2", employeeId: "e2", startDay: 15, endDay: 22, status: "approved" },
  { id: "v3", employeeId: "e3", startDay: 3, endDay: 7, status: "pending" },
  { id: "v4", employeeId: "e1", startDay: 20, endDay: 25, status: "approved" },
  { id: "v5", employeeId: "e4", startDay: 26, endDay: 29, status: "pending" },
];

let idCounter = 100;
const nextId = () => `v${idCounter++}`;

// ─── Проверка пересечения ──────────────────────────
const rangesOverlap = (a1: number, b1: number, a2: number, b2: number) =>
  a1 <= b2 && a2 <= b1;

const isFree = (
  vacations: Vacation[],
  employeeId: string,
  start: number,
  end: number,
  excludeId?: string
): boolean => {
  if (start > end) return false;
  for (const v of vacations) {
    if (v.employeeId !== employeeId) continue;
    if (excludeId && v.id === excludeId) continue;
    if (rangesOverlap(start, end, v.startDay, v.endDay)) return false;
  }
  return true;
};

// ─── Drag state ────────────────────────────────────
type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  origStart: number;
  origEnd: number;
  currentStart: number;
  currentEnd: number;
} | null;

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function VacationsDemo({ onInteract }: Props) {
  const [vacations, setVacations] = useState<Vacation[]>(INITIAL_VACATIONS);
  const [drag, setDrag] = useState<DragState>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: EMPLOYEES[0].id,
    startDay: 10,
    endDay: 15,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const interact = () => onInteract?.();

  const pending = useMemo(
    () => vacations.filter((v) => v.status === "pending"),
    [vacations]
  );

  const byEmployee = useMemo(() => {
    const map = new Map<string, Vacation[]>();
    for (const e of EMPLOYEES) map.set(e.id, []);
    for (const v of vacations) map.get(v.employeeId)?.push(v);
    return map;
  }, [vacations]);

  // Валидность формы (в реальном времени)
  const formValid =
    form.startDay >= 1 &&
    form.endDay <= DAYS_IN_MONTH &&
    form.startDay <= form.endDay &&
    isFree(vacations, form.employeeId, form.startDay, form.endDay);

  const formConflict =
    form.startDay <= form.endDay &&
    !isFree(vacations, form.employeeId, form.startDay, form.endDay);

  // ─── Drag ────────────────────────────────────────
  const onBarMouseDown = (
    e: React.MouseEvent,
    v: Vacation,
    mode: DragMode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      id: v.id,
      mode,
      startX: e.clientX,
      origStart: v.startDay,
      origEnd: v.endDay,
      currentStart: v.startDay,
      currentEnd: v.endDay,
    });
  };

  useEffect(() => {
    if (!drag) return;

    const draggedVac = vacations.find((v) => v.id === drag.id);
    if (!draggedVac) return;

    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - drag.startX) / CELL_WIDTH);
      let newStart = drag.origStart;
      let newEnd = drag.origEnd;

      if (drag.mode === "move") {
        newStart = drag.origStart + delta;
        newEnd = drag.origEnd + delta;
        const len = drag.origEnd - drag.origStart + 1;
        if (newStart < 1) {
          newStart = 1;
          newEnd = len;
        }
        if (newEnd > DAYS_IN_MONTH) {
          newEnd = DAYS_IN_MONTH;
          newStart = DAYS_IN_MONTH - len + 1;
        }
      } else if (drag.mode === "resize-start") {
        newStart = drag.origStart + delta;
        if (newStart < 1) newStart = 1;
        if (newStart > drag.currentEnd) newStart = drag.currentEnd;
      } else if (drag.mode === "resize-end") {
        newEnd = drag.origEnd + delta;
        if (newEnd > DAYS_IN_MONTH) newEnd = DAYS_IN_MONTH;
        if (newEnd < drag.currentStart) newEnd = drag.currentStart;
      }

      // 🛑 Главное: не пускаем в чужие отпуска
      if (
        !isFree(
          vacations,
          draggedVac.employeeId,
          newStart,
          newEnd,
          drag.id
        )
      ) {
        return; // замораживаем на последней валидной позиции
      }

      if (newStart !== drag.currentStart || newEnd !== drag.currentEnd) {
        setDrag((d) =>
          d ? { ...d, currentStart: newStart, currentEnd: newEnd } : d
        );
      }
    };

    const onUp = () => {
      if (
        drag.currentStart !== drag.origStart ||
        drag.currentEnd !== drag.origEnd
      ) {
        setVacations((prev) =>
          prev.map((v) =>
            v.id === drag.id
              ? { ...v, startDay: drag.currentStart, endDay: drag.currentEnd }
              : v
          )
        );
        interact();
      }
      setDrag(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [drag, vacations]);

  // ─── CRUD ────────────────────────────────────────
  const addVacation = () => {
    if (!formValid) {
      setFormError("Диапазон пересекается с существующим отпуском сотрудника");
      return;
    }
    setVacations((prev) => [
      ...prev,
      {
        id: nextId(),
        employeeId: form.employeeId,
        startDay: form.startDay,
        endDay: form.endDay,
        status: "pending",
      },
    ]);
    setShowForm(false);
    setForm({
      employeeId: EMPLOYEES[0].id,
      startDay: 10,
      endDay: 15,
    });
    setFormError(null);
    interact();
  };

  const approve = (id: string) => {
    setVacations((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: "approved" } : v))
    );
    interact();
  };

  const reject = (id: string) => {
    setVacations((prev) => prev.filter((v) => v.id !== id));
    interact();
  };

  const remove = (id: string) => {
    setVacations((prev) => prev.filter((v) => v.id !== id));
    interact();
  };

  const resetAll = () => {
    setVacations(INITIAL_VACATIONS);
    setShowForm(false);
    setDrag(null);
    setFormError(null);
  };

  // ─── Рендер ──────────────────────────────────────
  return (
    <div className="bg-white rounded-xl">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-emerald-600" />
            Отпуска · Октябрь 2026
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {EMPLOYEES.length} сотрудников · {vacations.length} отпусков
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                <AlertCircle className="w-3.5 h-3.5" />
                {pending.length} ждёт одобрения
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-medium transition-colors shadow-sm"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Отмена" : "Запросить отпуск"}
          </button>
        </div>
      </div>

      {/* Форма запроса */}
      {showForm && (
        <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4 animate-fade-in">
          <div className="text-sm font-semibold text-slate-900 mb-3">
            Новый отпуск
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Сотрудник
              </label>
              <select
                value={form.employeeId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, employeeId: e.target.value }));
                  setFormError(null);
                }}
                className="!text-sm"
              >
                {EMPLOYEES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                С (число)
              </label>
              <input
                type="number"
                min={1}
                max={DAYS_IN_MONTH}
                value={form.startDay}
                onChange={(e) => {
                  setForm((f) => ({ ...f, startDay: Number(e.target.value) }));
                  setFormError(null);
                }}
                className={`!text-sm ${formConflict ? "!border-rose-400" : ""}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                По (число)
              </label>
              <input
                type="number"
                min={1}
                max={DAYS_IN_MONTH}
                value={form.endDay}
                onChange={(e) => {
                  setForm((f) => ({ ...f, endDay: Number(e.target.value) }));
                  setFormError(null);
                }}
                className={`!text-sm ${formConflict ? "!border-rose-400" : ""}`}
              />
            </div>
          </div>

          {/* Сообщение о пересечении */}
          {formConflict && (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                У сотрудника уже есть отпуск в этом диапазоне. Выберите другие
                числа.
              </span>
            </div>
          )}
          {form.startDay > form.endDay && !formConflict && (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Дата начала позже даты окончания.</span>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              onClick={addVacation}
              disabled={!formValid}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              title={
                !formValid
                  ? "Диапазон невалиден или пересекается с существующим отпуском"
                  : ""
              }
            >
              <Check className="w-4 h-4" />
              Отправить на согласование
            </button>
          </div>
        </div>
      )}

      {/* Pending-заявки */}
      {pending.length > 0 && (
        <div className="mb-4 bg-amber-50 rounded-xl border border-amber-200 p-3 animate-fade-in">
          <div className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Требуют одобрения ({pending.length})
          </div>
          <div className="space-y-2">
            {pending.map((v) => {
              const emp = EMPLOYEES.find((e) => e.id === v.employeeId)!;
              return (
                <div
                  key={v.id}
                  className="bg-white rounded-lg border border-amber-200 px-3 py-2 flex items-center gap-3 flex-wrap"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {emp.name}{" "}
                      <span className="text-slate-500 font-normal">
                        · {v.startDay}–{v.endDay} октября
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">Отпуск</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => approve(v.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium"
                    >
                      <Check className="w-3 h-3" />
                      Одобрить
                    </button>
                    <button
                      onClick={() => reject(v.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium"
                    >
                      <X className="w-3 h-3" />
                      Отклонить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Легенда */}
      <div className="flex items-center gap-4 mb-3 text-xs text-slate-600 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          Одобрен
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-400 ring-1 ring-amber-500" />
          На согласовании
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 ring-1 ring-blue-300" />
          Сегодня
        </div>
        <div className="ml-auto text-slate-400 hidden sm:inline">
          💡 Тяните полосу · за края — растянуть (через другой отпуск не выйдет)
        </div>
      </div>

      {/* Гант */}
      <div className="-mx-1 overflow-x-auto pb-3">
        <div
          className="min-w-fit px-1"
          style={{ width: EMP_COL_WIDTH + DAYS_IN_MONTH * CELL_WIDTH }}
        >
          {/* Шапка дней */}
          <div className="flex border-b-2 border-slate-200 bg-slate-50 rounded-t-lg">
            <div
              className="shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 border-r-2 border-slate-200 flex items-center"
              style={{ width: EMP_COL_WIDTH }}
            >
              Сотрудник
            </div>
            {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map(
              (day) => {
                const weekend = isWeekend(day);
                const isToday = day === TODAY_DAY;
                return (
                  <div
                    key={day}
                    className={`shrink-0 flex flex-col items-center justify-center border-r border-slate-200 ${
                      isToday
                        ? "bg-blue-100"
                        : weekend
                        ? "bg-slate-100"
                        : "bg-slate-50"
                    }`}
                    style={{ width: CELL_WIDTH, height: 52 }}
                  >
                    <div
                      className={`text-[9px] uppercase tracking-wide ${
                        isToday
                          ? "text-blue-700 font-semibold"
                          : weekend
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {getWeekdayShort(day)}
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        isToday
                          ? "text-blue-700"
                          : weekend
                          ? "text-slate-400"
                          : "text-slate-700"
                      }`}
                    >
                      {day}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Строки */}
          {EMPLOYEES.map((emp) => {
            const empVacations = byEmployee.get(emp.id) ?? [];
            return (
              <div
                key={emp.id}
                className="flex border-b border-slate-100 hover:bg-slate-50/30 transition-colors"
                style={{ height: ROW_HEIGHT }}
              >
                <div
                  className="shrink-0 px-3 flex items-center gap-2 border-r-2 border-slate-200"
                  style={{ width: EMP_COL_WIDTH }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {emp.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {emp.position}
                    </div>
                  </div>
                </div>

                <div
                  className="relative"
                  style={{ width: DAYS_IN_MONTH * CELL_WIDTH }}
                >
                  {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map(
                    (day) => {
                      const weekend = isWeekend(day);
                      const isToday = day === TODAY_DAY;
                      return (
                        <div
                          key={day}
                          className={`absolute inset-y-0 border-r border-slate-100 ${
                            isToday
                              ? "bg-blue-50/60"
                              : weekend
                              ? "bg-slate-50"
                              : ""
                          }`}
                          style={{
                            left: (day - 1) * CELL_WIDTH,
                            width: CELL_WIDTH,
                          }}
                        />
                      );
                    }
                  )}

                  {empVacations.map((v) => {
                    const isDragging = drag?.id === v.id;
                    const startDay = isDragging
                      ? drag!.currentStart
                      : v.startDay;
                    const endDay = isDragging ? drag!.currentEnd : v.endDay;

                    const left = (startDay - 1) * CELL_WIDTH + 2;
                    const width = (endDay - startDay + 1) * CELL_WIDTH - 4;

                    const isPending = v.status === "pending";
                    const baseClass = isPending
                      ? "bg-amber-400 text-amber-900 ring-2 ring-amber-500"
                      : "bg-emerald-500 text-white";

                    return (
                      <div
                        key={v.id}
                        onMouseDown={(e) => onBarMouseDown(e, v, "move")}
                        className={`absolute rounded-md text-[11px] font-semibold flex items-center justify-center shadow-sm cursor-grab active:cursor-grabbing group transition-shadow ${baseClass} ${
                          isDragging
                            ? "shadow-lg opacity-90 ring-offset-1 ring-slate-900"
                            : "hover:ring-2 hover:ring-offset-1 hover:ring-slate-400"
                        }`}
                        style={{
                          left,
                          width,
                          top: 10,
                          height: ROW_HEIGHT - 20,
                        }}
                        title={`${v.startDay}–${v.endDay} октября`}
                      >
                        {width > 40 && (
                          <span className="truncate px-2 pointer-events-none">
                            {isPending ? "На согласовании" : "Отпуск"}
                          </span>
                        )}

                        <div
                          onMouseDown={(e) =>
                            onBarMouseDown(e, v, "resize-start")
                          }
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-md"
                        />
                        <div
                          onMouseDown={(e) =>
                            onBarMouseDown(e, v, "resize-end")
                          }
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-md"
                        />

                        {!isPending && !isDragging && width > 60 && (
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(v.id);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-300 shadow text-slate-500 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Удалить отпуск"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Подсказка + сброс */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Кликните на жёлтую полосу, чтобы одобрить сверху · тяните за
            края для изменения
          </span>
          <span className="sm:hidden">💡 Свайпните, чтобы увидеть весь месяц</span>
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