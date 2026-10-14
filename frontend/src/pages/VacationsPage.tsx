import {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Plus,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Palmtree,
} from "lucide-react";
import { useVacations } from "../store/vacations";
import { useUsers } from "../store/users";
import { useAuth } from "../store/auth";
import type { Vacation } from "../api/vacations";
import NavBar from "../components/NavBar";

// ─── Константы ───────────────────────────────────────
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const CELL_WIDTH = 36;
const ROW_HEIGHT = 44;
const USER_COL_WIDTH = 200;

// ─── Утилиты ─────────────────────────────────────────
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

// Отпуск, обрезанный по границам текущего месяца (для отображения)
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

// ─── Состояние drag ──────────────────────────────────
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

// ─── Модалка ─────────────────────────────────────────
type ModalMode =
  | { kind: "closed" }
  | { kind: "create"; userId: string | null }
  | { kind: "edit"; vacation: Vacation };

// ═══════════════════════════════════════════════════════
// ОСНОВНОЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════
export default function VacationsPage() {
  const { user } = useAuth();
  const { all, loading, error, fetchAll, create, update, remove } =
    useVacations();
  const { items: users, fetch: fetchUsers } = useUsers();

  const [modal, setModal] = useState<ModalMode>({ kind: "closed" });

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayStr = today.toISOString().slice(0, 10);

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";

  const canEdit = useCallback(
    (vacUserId: string) => isAdmin || vacUserId === user?.id,
    [isAdmin, user?.id]
  );

  useEffect(() => {
    fetchAll();
    fetchUsers();
  }, [fetchAll, fetchUsers]);

  // ─── Drag ───────────────────────────────────────────
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
        // Был клик — открыть модалку
        const vac = all.find((v) => v.id === ds.vacationId);
        if (vac) setModal({ kind: "edit", vacation: vac });
        return;
      }

      // Ничего не изменилось — выходим
      if (
        ds.currentStart === ds.originalStart &&
        ds.currentEnd === ds.originalEnd
      ) {
        return;
      }

      try {
        await update(ds.vacationId, {
          startDate: ds.currentStart,
          endDate: ds.currentEnd,
        });
      } catch (err: any) {
        alert(err.response?.data?.error ?? "Ошибка сохранения");
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [all, update]);

  const onBarMouseDown = (
    e: React.MouseEvent,
    v: Vacation,
    mode: DragMode
  ) => {
    if (!canEdit(v.userId)) {
      alert("Можно редактировать только свой отпуск");
      return;
    }
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

  // ─── Навигация по месяцам ───────────────────────────
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

  // ─── Данные для отображения ─────────────────────────
  const rows = useMemo(() => {
    return users.map((u) => {
      const userVacations = all.filter((v) => v.userId === u.id);
      const blocks = userVacations
        .map((v) => blockFromRange(v, v.startDate, v.endDate, days))
        .filter((b): b is Block => b !== null);
      return { user: u, blocks };
    });
  }, [users, all, days]);

  const busyDays = useMemo(() => {
    const set = new Set<number>();
    for (const row of rows) {
      for (const b of row.blocks) {
        for (let i = b.startIndex; i <= b.endIndex; i++) set.add(i);
      }
    }
    return set;
  }, [rows]);

  const onDelete = async (id: string) => {
    if (!confirm("Удалить отпуск?")) return;
    try {
      await remove(id);
      setModal({ kind: "closed" });
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Отпуска</h1>
            <p className="text-sm text-slate-500 mt-1">
              Тяните полосу, чтобы сдвинуть отпуск, или за края — чтобы
              изменить длительность
            </p>
          </div>
          <button
            onClick={() =>
              setModal({
                kind: "create",
                userId: isAdmin ? null : user?.id ?? null,
              })
            }
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            Добавить отпуск
          </button>
        </div>

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
            <div className="font-semibold text-slate-900 min-w-[140px] text-center">
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
            Сотрудников: {users.length} · отпусков в месяце:{" "}
            {rows.reduce((sum, r) => sum + r.blocks.length, 0)}
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Пустое состояние */}
        {!loading && users.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Palmtree className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Нет сотрудников
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Сначала добавьте сотрудников на странице «Сотрудники»
            </p>
          </div>
        )}

        {/* Таблица-гант */}
        {users.length > 0 && (
          <div
            className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${
              dragPreview ? "select-none" : ""
            }`}
          >
            <div className="overflow-x-auto">
              <div
                className="min-w-fit"
                style={{ width: USER_COL_WIDTH + days.length * CELL_WIDTH }}
              >
                {/* Заголовок с днями */}
                <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                  <div
                    className="shrink-0 px-4 py-3 font-medium text-xs uppercase tracking-wide text-slate-600 border-r border-slate-200 flex items-center"
                    style={{ width: USER_COL_WIDTH }}
                  >
                    Сотрудник
                  </div>
                  {days.map((d, i) => {
                    const dow = dayOfWeek(d);
                    const isWeekend = dow >= 5;
                    const isToday = d === todayStr;
                    const hasVacation = busyDays.has(i);
                    return (
                      <div
                        key={d}
                        className={`shrink-0 flex flex-col items-center justify-center border-r border-slate-200 transition-colors ${
                          isToday
                            ? "bg-brand-100"
                            : hasVacation
                            ? "bg-amber-50"
                            : isWeekend
                            ? "bg-slate-100/70"
                            : ""
                        }`}
                        style={{ width: CELL_WIDTH, height: 48 }}
                      >
                        <div
                          className={`text-[10px] uppercase tracking-wide ${
                            isWeekend ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {WEEKDAYS_SHORT[dow]}
                        </div>
                        <div
                          className={`text-sm font-semibold ${
                            isToday
                              ? "text-brand-700"
                              : isWeekend
                              ? "text-slate-400"
                              : "text-slate-700"
                          }`}
                        >
                          {parseInt(d.slice(8), 10)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Строки сотрудников */}
                {rows.map(({ user: u, blocks }) => (
                  <div
                    key={u.id}
                    className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Колонка сотрудника */}
                    <div
                      className="shrink-0 px-4 flex items-center gap-2.5 border-r border-slate-200 bg-white"
                      style={{ width: USER_COL_WIDTH }}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(
                          u.id
                        )}`}
                      >
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {u.name}
                        </div>
                      </div>
                    </div>

                    {/* Дни с полосами */}
                    <div
                      className="relative"
                      style={{ width: days.length * CELL_WIDTH }}
                    >
                      {/* Фоновые ячейки */}
                      {days.map((d, i) => {
                        const dow = dayOfWeek(d);
                        const isWeekend = dow >= 5;
                        const isToday = d === todayStr;
                        return (
                          <div
                            key={d}
                            className={`absolute inset-y-0 border-r border-slate-100 ${
                              isToday
                                ? "bg-brand-50/60"
                                : isWeekend
                                ? "bg-slate-50"
                                : ""
                            }`}
                            style={{
                              left: i * CELL_WIDTH,
                              width: CELL_WIDTH,
                            }}
                          />
                        );
                      })}

                      {/* Полосы отпусков */}
                      {blocks.map((b, idx) => {
                        const isDragging = dragPreview?.id === b.vacation.id;
                        const effStart = isDragging
                          ? dragPreview!.start
                          : b.vacation.startDate;
                        const effEnd = isDragging
                          ? dragPreview!.end
                          : b.vacation.endDate;
                        const effBlock = blockFromRange(
                          b.vacation,
                          effStart,
                          effEnd,
                          days
                        );
                        if (!effBlock) return null;

                        const editable = canEdit(b.vacation.userId);
                        return (
                          <div
                            key={b.vacation.id + "-" + idx}
                            onMouseDown={(e) =>
                              onBarMouseDown(e, b.vacation, "move")
                            }
                            className={`absolute rounded-md text-white text-[11px] font-medium flex items-center justify-center transition-shadow shadow-sm group ${barColor(
                              u.id
                            )} ${
                              editable
                                ? "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-offset-1 hover:ring-slate-400"
                                : "cursor-not-allowed opacity-70"
                            } ${
                              isDragging
                                ? "ring-2 ring-offset-1 ring-slate-900 shadow-lg opacity-90"
                                : ""
                            }`}
                            style={{
                              left: effBlock.startIndex * CELL_WIDTH + 2,
                              width: effBlock.daysCount * CELL_WIDTH - 4,
                              top: 8,
                              height: ROW_HEIGHT - 16,
                            }}
                            title={`${formatDateRU(effStart)} — ${formatDateRU(
                              effEnd
                            )}${
                              b.vacation.comment
                                ? "\n" + b.vacation.comment
                                : ""
                            }${
                              editable
                                ? "\n\nТяните, чтобы сдвинуть\nЗа края — чтобы изменить длительность"
                                : ""
                            }`}
                          >
                            {/* Текст */}
                            {effBlock.daysCount >= 4 && (
                              <span className="truncate px-3 pointer-events-none">
                                {b.vacation.comment || "Отпуск"}
                              </span>
                            )}

                            {/* Ручки resize (только для редактируемых) */}
                            {editable && (
                              <>
                                <div
                                  onMouseDown={(e) =>
                                    onBarMouseDown(
                                      e,
                                      b.vacation,
                                      "resize-start"
                                    )
                                  }
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-md"
                                  title="Потяните, чтобы изменить дату начала"
                                />
                                <div
                                  onMouseDown={(e) =>
                                    onBarMouseDown(
                                      e,
                                      b.vacation,
                                      "resize-end"
                                    )
                                  }
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-md"
                                  title="Потяните, чтобы изменить дату окончания"
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Легенда */}
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
              <span className="ml-auto hidden md:inline text-slate-400">
                Клик — открыть · Тянуть — сдвинуть · За края — растянуть
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ═══ Модалка ═════════════════════════════════════ */}
      {modal.kind !== "closed" && (
        <VacationModal
          mode={modal}
          users={users}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? ""}
          onClose={() => setModal({ kind: "closed" })}
          onCreate={async (payload) => {
            await create(payload);
            setModal({ kind: "closed" });
          }}
          onUpdate={async (id, payload) => {
            await update(id, payload);
            setModal({ kind: "closed" });
          }}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МОДАЛКА
// ═══════════════════════════════════════════════════════
function VacationModal({
  mode,
  users,
  isAdmin,
  currentUserId,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  mode: Exclude<ModalMode, { kind: "closed" }>;
  users: { id: string; name: string; email: string }[];
  isAdmin: boolean;
  currentUserId: string;
  onClose: () => void;
  onCreate: (payload: {
    userId?: string;
    startDate: string;
    endDate: string;
    comment?: string;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Partial<{
      startDate: string;
      endDate: string;
      comment: string | null;
    }>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isEdit = mode.kind === "edit";
  const existing = isEdit ? mode.vacation : null;

  const [userId, setUserId] = useState(
    isEdit
      ? existing!.userId
      : mode.kind === "create"
      ? mode.userId ?? currentUserId
      : currentUserId
  );
  const [startDate, setStartDate] = useState(existing?.startDate ?? "");
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert("Заполните даты");
      return;
    }
    if (startDate > endDate) {
      alert("Дата начала позже окончания");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await onUpdate(existing!.id, {
          startDate,
          endDate,
          comment: comment || null,
        });
      } else {
        await onCreate({
          userId: userId || undefined,
          startDate,
          endDate,
          comment: comment || undefined,
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                {isEdit ? "Редактировать отпуск" : "Новый отпуск"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit
                  ? "Измените даты или комментарий"
                  : "Укажите даты отпуска"}
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

        <form onSubmit={onSubmit} className="space-y-4">
          {isAdmin && !isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Сотрудник
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">— Выберите —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEdit && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700">
              <span className="text-slate-500">Сотрудник: </span>
              {users.find((u) => u.id === userId)?.name ?? "—"}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Начало
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Окончание
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Комментарий
            </label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ежегодный оплачиваемый"
              maxLength={255}
            />
          </div>

          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-all"
            >
              {busy ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
            </button>

            {isEdit && (
              <button
                type="button"
                onClick={() => onDelete(existing!.id)}
                className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}