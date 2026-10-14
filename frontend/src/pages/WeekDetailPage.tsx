import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Copy,
  CheckCircle2,
  Plus,
  X,
  Trash2,
  Clock,
  CalendarDays,
  AlertCircle,
  Pencil,
  Check,
  ClipboardPaste,
  Clipboard,
  GripVertical,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useWeeks } from "../store/weeks";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useUsers } from "../store/users";
import { vacationsApi } from "../api/vacations";
import { shiftsApi, type ScheduledShift } from "../api/weeks";
import NavBar from "../components/NavBar";
import { weekDates, dayLabel, shortDate, fullDate } from "../lib/dates";

type ShiftSnapshot = {
  templateId: string | null;
  userId: string | null;
  startTime: string;
  endTime: string;
};

export default function WeekDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentWeek,
    loading,
    error,
    fetchWeek,
    publishWeek,
    addShift,
    updateShift,
    removeShift,
    duplicateWeek,
  } = useWeeks();
  const { items: templates, fetch: fetchTemplates } = useShiftTemplates();
  const { items: users, fetch: fetchUsers } = useUsers();

  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    templateId: "",
    userId: "",
    startTime: "09:00",
    endTime: "18:00",
  });
  const [publishing, setPublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [checkingVacation, setCheckingVacation] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [clipboard, setClipboard] = useState<ShiftSnapshot[]>([]);
  const [pasteBusy, setPasteBusy] = useState<string | null>(null);

  // Drag
  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Модалка редактирования смены
  const [editingShift, setEditingShift] = useState<ScheduledShift | null>(null);

  // Разворот дня (вне режима редактирования)
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchWeek(id);
    fetchTemplates();
    fetchUsers();
  }, [id, fetchWeek, fetchTemplates, fetchUsers]);

  // Сбрасываем разворот при входе в режим редактирования
  useEffect(() => {
    if (editMode) setExpandedDate(null);
  }, [editMode]);

  if (loading && !currentWeek) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-slate-500 text-sm">Загрузка...</p>
        </main>
      </div>
    );
  }

  if (error || !currentWeek) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <p
            className={
              error ? "text-red-500 text-sm" : "text-slate-500 text-sm"
            }
          >
            {error ?? "Неделя не найдена"}
          </p>
        </main>
      </div>
    );
  }

  const isDraft = currentWeek.status === "DRAFT";
  const isLocked = currentWeek.status === "LOCKED";
  const canEdit = editMode && !isLocked;

  const dates = weekDates(currentWeek.weekStartDate);
  const weekStart = shortDate(dates[0]);
  const weekEnd = shortDate(dates[6]);

  const shiftsByDate: Record<string, typeof currentWeek.shifts> = {};
  for (const d of dates) shiftsByDate[d] = [];
  for (const s of currentWeek.shifts ?? []) {
    const d = String(s.shiftDate).slice(0, 10);
    if (shiftsByDate[d]) shiftsByDate[d].push(s);
  }

  const onTemplateChange = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    setForm((f) => ({
      ...f,
      templateId,
      ...(tpl ? { startTime: tpl.startTime, endTime: tpl.endTime } : {}),
    }));
  };

  const onAddShift = async (date: string) => {
    if (form.userId) {
      setCheckingVacation(true);
      try {
        const { onVacation, vacation } = await vacationsApi.check(
          form.userId,
          date
        );
        if (onVacation) {
          const userName =
            users.find((u) => u.id === form.userId)?.name ?? "Сотрудник";
          const ok = window.confirm(
            `⚠️ ${userName} находится в отпуске с ${vacation!.startDate} по ${
              vacation!.endDate
            }.\n\nВсё равно назначить смену на ${date}?`
          );
          if (!ok) {
            setCheckingVacation(false);
            return;
          }
        }
      } catch {
        // ignore
      } finally {
        setCheckingVacation(false);
      }
    }

    if (form.userId) {
      try {
        const check = await shiftsApi.checkLimits({
          userId: form.userId,
          weekId: currentWeek.id,
          startTime: form.startTime,
          endTime: form.endTime,
        });
        if (check.exceeds) {
          const ok = window.confirm(
            `⚠️ Превышение рабочей недели\n\n` +
              `${check.userName} уже работает ${check.currentHours} ч за эту неделю.\n` +
              `После добавления смены (${check.newShiftHours} ч) станет ${check.totalHours} ч.\n` +
              `Это на ${check.excess} ч больше нормы (${check.limit} ч).\n\n` +
              `Всё равно добавить?`
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    try {
      await addShift({
        weekId: currentWeek.id,
        templateId: form.templateId || undefined,
        userId: form.userId || undefined,
        shiftDate: date,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      setShowAddFor(null);
      setForm({
        templateId: "",
        userId: "",
        startTime: "09:00",
        endTime: "18:00",
      });
    } catch (e: any) {
      window.alert(e.response?.data?.error ?? "Ошибка создания смены");
    }
  };

  const onRemoveShift = async (shiftId: string) => {
    if (!window.confirm("Удалить смену?")) return;
    try {
      await removeShift(shiftId);
      if (editingShift?.id === shiftId) setEditingShift(null);
    } catch (e: any) {
      window.alert(e.response?.data?.error ?? "Ошибка удаления");
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      const result = await publishWeek(currentWeek.id);
      if (!result.ok) {
        window.alert(
          "Нарушения ТК РФ:\n\n" + (result.violations ?? []).join("\n")
        );
      } else {
        window.alert("Неделя опубликована!");
        setEditMode(false);
      }
    } catch (e: any) {
      window.alert(e.response?.data?.error ?? "Ошибка публикации");
    } finally {
      setPublishing(false);
    }
  };

  const onDuplicate = async () => {
    setDuplicating(true);
    try {
      const newWeek = await duplicateWeek(currentWeek.id);
      navigate(`/weeks/${newWeek.id}`);
    } catch (e: any) {
      window.alert(e.response?.data?.error ?? "Ошибка копирования");
    } finally {
      setDuplicating(false);
    }
  };

  const onCopyDay = (date: string) => {
    const shifts = shiftsByDate[date] ?? [];
    if (shifts.length === 0) {
      window.alert("В этом дне нет смен для копирования");
      return;
    }
    const snapshots: ShiftSnapshot[] = shifts.map((s) => ({
      templateId: s.templateId,
      userId: s.userId,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
    setClipboard(snapshots);
  };

  const onPasteDay = async (date: string) => {
    if (clipboard.length === 0) return;

    const skipUserIds = new Set<string>();
    for (const snap of clipboard) {
      if (!snap.userId) continue;
      try {
        const { onVacation, vacation } = await vacationsApi.check(
          snap.userId,
          date
        );
        if (onVacation) {
          const userName =
            users.find((u) => u.id === snap.userId)?.name ?? "Сотрудник";
          const ok = window.confirm(
            `⚠️ ${userName} в отпуске (${vacation!.startDate}–${
              vacation!.endDate
            }).\n\nВсё равно вставить эту смену на ${date}?`
          );
          if (!ok) skipUserIds.add(snap.userId);
        }
      } catch {
        // ignore
      }
    }

    setPasteBusy(date);
    let success = 0;
    let failed = 0;

    for (const snap of clipboard) {
      if (snap.userId && skipUserIds.has(snap.userId)) continue;
      try {
        await addShift({
          weekId: currentWeek.id,
          templateId: snap.templateId ?? undefined,
          userId: snap.userId ?? undefined,
          shiftDate: date,
          startTime: snap.startTime,
          endTime: snap.endTime,
        });
        success++;
      } catch (e: any) {
        failed++;
        // eslint-disable-next-line no-console
        console.error("Ошибка вставки смены:", e);
      }
    }

    setPasteBusy(null);
    if (failed > 0) {
      window.alert(`Вставлено: ${success}, с ошибками: ${failed}`);
    }
  };

  // Drag-and-drop
  const onDragStart = (e: React.DragEvent, shiftId: string) => {
    if (!canEdit) return;
    setDraggingShiftId(shiftId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", shiftId);
  };

  const onDragEnd = () => {
    setDraggingShiftId(null);
    setDragOverDate(null);
  };

  const onDragOver = (e: React.DragEvent, date: string) => {
    if (!canEdit || !draggingShiftId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== date) setDragOverDate(date);
  };

  const onDragLeave = (e: React.DragEvent, date: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverDate === date) setDragOverDate(null);
  };

  const onDrop = async (e: React.DragEvent, newDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!canEdit || !draggingShiftId) return;

    const shift = (currentWeek.shifts ?? []).find(
      (s) => s.id === draggingShiftId
    );
    setDraggingShiftId(null);
    if (!shift) return;

    const oldDate = String(shift.shiftDate).slice(0, 10);
    if (oldDate === newDate) return;

    if (shift.userId) {
      try {
        const check = await shiftsApi.checkLimits({
          userId: shift.userId,
          weekId: currentWeek.id,
          startTime: shift.startTime,
          endTime: shift.endTime,
        });
        if (check.exceeds) {
          const ok = window.confirm(
            `⚠️ У сотрудника уже превышение рабочей недели: ${check.currentHours} ч при норме ${check.limit} ч.\n\nВсё равно перенести смену на ${newDate}?`
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    if (shift.userId) {
      try {
        const { onVacation, vacation } = await vacationsApi.check(
          shift.userId,
          newDate
        );
        if (onVacation) {
          const userName =
            users.find((u) => u.id === shift.userId)?.name ?? "Сотрудник";
          const ok = window.confirm(
            `⚠️ ${userName} находится в отпуске с ${vacation!.startDate} по ${
              vacation!.endDate
            }.\n\nВсё равно перенести смену на ${newDate}?`
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    try {
      await updateShift(shift.id, { shiftDate: newDate });
    } catch (err: any) {
      window.alert(err.response?.data?.error ?? "Ошибка переноса");
    }
  };

  // Клик по дню — разворот (только вне режима редактирования)
  const onDayClick = (date: string) => {
    if (editMode) return;
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const userById = (uid: string | null) =>
    uid ? users.find((u) => u.id === uid)?.name ?? "—" : "Не назначен";

  const templateById = (tid: string | null) =>
    tid ? templates.find((t) => t.id === tid) : undefined;

  const totalShifts = currentWeek.shifts?.length ?? 0;
  const hasExpanded = !editMode && expandedDate !== null;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Хлебные крошки + кнопки */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <button
            onClick={() => navigate("/weeks")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            К списку недель
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {!isLocked && (
              <button
                onClick={() => {
                  setEditMode((v) => !v);
                  if (editMode) {
                    setShowAddFor(null);
                    setClipboard([]);
                  }
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  editMode
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {editMode ? (
                  <>
                    <Check className="w-4 h-4" />
                    Готово
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    Редактировать
                  </>
                )}
              </button>
            )}

            <button
              onClick={onDuplicate}
              disabled={duplicating}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-all"
            >
              <Copy className="w-4 h-4" />
              {duplicating ? "..." : "Скопировать в следующую"}
            </button>

            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium ${
                isDraft
                  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                  : isLocked
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {isDraft ? (
                <>Черновик</>
              ) : isLocked ? (
                <>Заблокирован</>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Опубликован
                </>
              )}
            </span>

            {isDraft && (
              <button
                onClick={onPublish}
                disabled={publishing}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                {publishing ? "..." : "Опубликовать"}
              </button>
            )}
          </div>
        </div>

        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            {weekStart} — {weekEnd}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Неделя с {fullDate(currentWeek.weekStartDate)} · {totalShifts} смен
          </p>
        </div>

        {/* Баннер режима редактирования */}
        {editMode && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-start gap-3 animate-fade-in">
            <Pencil className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <div className="font-medium text-emerald-900">
                Режим редактирования
              </div>
              <div className="text-emerald-700 mt-0.5">
                Перетаскивайте смены между днями. <b>Клик по смене</b> —
                откроет редактирование. Копируйте смены между днями.
                {clipboard.length > 0 && (
                  <>
                    {" "}
                    · В буфере <b>{clipboard.length}</b>{" "}
                    {clipboard.length === 1 ? "смена" : "смен"}.
                  </>
                )}
              </div>
            </div>
            {clipboard.length > 0 && (
              <button
                onClick={() => setClipboard([])}
                className="text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
              >
                Очистить буфер
              </button>
            )}
          </div>
        )}

        {/* Подсказка разворота (вне режима редактирования) */}
        {!editMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 flex items-center gap-3 text-xs text-blue-800">
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span>
              Нажмите на любой день, чтобы развернуть его и увидеть все смены
              в одну линию. Повторный клик — свернуть.
            </span>
          </div>
        )}

        {/* Предупреждение о шаблонах */}
        {templates.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-900">
                У вас нет шаблонов смен
              </div>
              <div className="text-amber-700 mt-0.5">
                Создайте их на странице{" "}
                <button
                  onClick={() => navigate("/templates")}
                  className="underline font-medium hover:text-amber-900"
                >
                  Шаблоны смен
                </button>{" "}
                — это ускорит добавление.
              </div>
            </div>
          </div>
        )}

        {/* Сетка дней: flex на lg, чтобы разворот работал */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:flex lg:flex-row lg:items-stretch">
          {dates.map((date) => {
            const dayShifts = shiftsByDate[date] ?? [];
            const isToday = date === new Date().toISOString().slice(0, 10);
            const hasClipboard = clipboard.length > 0;
            const isPasting = pasteBusy === date;
            const isDragOver = dragOverDate === date;
            const isExpanded = !editMode && expandedDate === date;

            return (
              <div
                key={date}
                onClick={() => onDayClick(date)}
                onDragOver={(e) => onDragOver(e, date)}
                onDragLeave={(e) => onDragLeave(e, date)}
                onDrop={(e) => onDrop(e, date)}
                className={`bg-white rounded-2xl border shadow-sm p-3 min-h-[220px] flex flex-col transition-all duration-300 ${
                  !editMode ? "cursor-pointer" : ""
                } ${
                  isDragOver
                    ? "border-brand-400 ring-2 ring-brand-500/30 bg-brand-50/40"
                    : isToday
                    ? "border-brand-300 ring-2 ring-brand-500/10"
                    : isExpanded
                    ? "border-brand-400 ring-2 ring-brand-400/40"
                    : canEdit
                    ? "border-emerald-200"
                    : "border-slate-200"
                } ${
                  isExpanded ? "lg:flex-[3]" : "lg:flex-1"
                } ${
                  hasExpanded && !isExpanded ? "lg:min-w-0" : ""
                } hover:border-slate-300`}
              >
                {/* Заголовок дня */}
                <div
                  className={`mb-3 pb-2 border-b ${
                    isToday ? "border-brand-200" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`font-semibold ${
                        isToday ? "text-brand-700" : "text-slate-900"
                      }`}
                    >
                      {dayLabel(date)}
                    </div>

                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="text-[10px] uppercase tracking-wide text-brand-600 font-semibold">
                          сегодня
                        </span>
                      )}
                      {!editMode && (
                        <span className="text-slate-300">
                          {isExpanded ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                    <span>{shortDate(date)}</span>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyDay(date);
                          }}
                          disabled={dayShifts.length === 0}
                          className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          title={
                            dayShifts.length === 0
                              ? "Нет смен для копирования"
                              : `Скопировать ${dayShifts.length} смен(ы)`
                          }
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPasteDay(date);
                          }}
                          disabled={!hasClipboard || isPasting}
                          className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          title={
                            !hasClipboard
                              ? "Буфер пуст"
                              : `Вставить ${clipboard.length} смен(ы)`
                          }
                        >
                          {isPasting ? (
                            <span className="text-[10px]">...</span>
                          ) : (
                            <ClipboardPaste className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Смены */}
                <div
                  className={`${
                    isExpanded
                      ? "flex flex-wrap gap-2 content-start"
                      : "space-y-2"
                  } flex-1`}
                >
                  {dayShifts.map((s) => {
                    const tpl = templateById(s.templateId);
                    const color = tpl?.color ?? "#3B82F6";
                    const isDragging = draggingShiftId === s.id;
                    return (
                      <div
                        key={s.id}
                        draggable={canEdit}
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onDragEnd={onDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canEdit) return;
                          if (draggingShiftId) return;
                          setEditingShift(s);
                        }}
                        className={`group relative rounded-lg border-l-4 transition-all ${
                          isExpanded
                            ? "flex-1 min-w-[140px] text-[11px] p-1.5"
                            : "text-xs p-2"
                        } ${
                          canEdit
                            ? "cursor-pointer active:cursor-grabbing hover:ring-2 hover:ring-offset-1 hover:ring-brand-300"
                            : ""
                        } ${isDragging ? "opacity-30" : ""}`}
                        style={{
                          borderLeftColor: color,
                          backgroundColor: color + "10",
                        }}
                      >
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          {canEdit && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{ color }}
                          />
                          {s.startTime}–{s.endTime}
                        </div>
                        <div
                          className={`text-slate-600 truncate ${
                            isExpanded ? "mt-0.5" : "mt-0.5"
                          }`}
                        >
                          {userById(s.userId)}
                        </div>
                        {tpl && !isExpanded && (
                          <div className="text-slate-400 truncate mt-0.5">
                            {tpl.name}
                          </div>
                        )}
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveShift(s.id);
                            }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-0.5 rounded transition-all"
                            title="Удалить"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {dayShifts.length === 0 && (
                    <div
                      className={`text-xs text-center ${
                        isExpanded ? "py-6" : "py-4"
                      } ${
                        isDragOver
                          ? "text-brand-500 font-medium"
                          : "text-slate-300"
                      }`}
                    >
                      {isDragOver ? "отпустите здесь" : "нет смен"}
                    </div>
                  )}
                </div>

                {/* Кнопка добавления */}
                {canEdit && showAddFor !== date && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddFor(date);
                    }}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-brand-600 hover:bg-brand-50 py-1.5 rounded-lg border border-dashed border-slate-200 hover:border-brand-300 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    смена
                  </button>
                )}

                {/* Форма добавления */}
                {canEdit && showAddFor === date && (
                  <div
                    className="mt-2 space-y-1.5 text-xs animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={form.templateId}
                      onChange={(e) => onTemplateChange(e.target.value)}
                      className="!text-xs !py-1.5"
                    >
                      <option value="">Без шаблона</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={form.userId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, userId: e.target.value }))
                      }
                      className="!text-xs !py-1.5"
                    >
                      <option value="">Не назначен</option>
                      {users.map((u) => {
                        const userShifts = (currentWeek.shifts ?? []).filter(
                          (s) => s.userId === u.id
                        );
                        const hours = userShifts.reduce((sum, s) => {
                          const [sh, sm] = s.startTime.split(":").map(Number);
                          const [eh, em] = s.endTime.split(":").map(Number);
                          let m = eh * 60 + em - (sh * 60 + sm);
                          if (m <= 0) m += 24 * 60;
                          return sum + m / 60;
                        }, 0);
                        const rounded = Math.round(hours * 10) / 10;
                        const overload = rounded > 40;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} — {rounded} ч{overload ? " ⚠" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex gap-1">
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            startTime: e.target.value,
                          }))
                        }
                        className="!text-xs !px-1.5 !py-1"
                      />
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            endTime: e.target.value,
                          }))
                        }
                        className="!text-xs !px-1.5 !py-1"
                      />
                    </div>

                    <div className="flex items-start gap-1 text-[10px] text-slate-400 leading-tight">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Проверим отпуск и лимит 40 ч/нед</span>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddShift(date);
                        }}
                        disabled={checkingVacation}
                        className="flex-1 bg-brand-600 text-white py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-xs font-medium transition-colors"
                      >
                        {checkingVacation ? "..." : "Добавить"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddFor(null);
                        }}
                        className="px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Отмена"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Модалка редактирования смены */}
      {editingShift && (
        <ShiftEditModal
          shift={editingShift}
          weekId={currentWeek.id}
          allShifts={currentWeek.shifts ?? []}
          users={users}
          templates={templates}
          onClose={() => setEditingShift(null)}
          onSaved={() => setEditingShift(null)}
          onUpdate={updateShift}
          onDelete={onRemoveShift}
        />
      )}
    </div>
  );
}

// ═══ Модалка редактирования смены ═══════════════════════
function ShiftEditModal({
  shift,
  weekId,
  users,
  templates,
  onClose,
  onUpdate,
  onDelete,
}: {
  shift: ScheduledShift;
  weekId: string;
  allShifts: ScheduledShift[];
  users: { id: string; name: string; email: string }[];
  templates: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  }[];
  onClose: () => void;
  onSaved: (updated: ScheduledShift) => void;
  onUpdate: (
    id: string,
    input: Partial<{
      templateId: string | null;
      userId: string | null;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [templateId, setTemplateId] = useState(shift.templateId ?? "");
  const [userId, setUserId] = useState(shift.userId ?? "");
  const [startTime, setStartTime] = useState(shift.startTime);
  const [endTime, setEndTime] = useState(shift.endTime);
  const [shiftDate, setShiftDate] = useState(
    String(shift.shiftDate).slice(0, 10)
  );
  const [busy, setBusy] = useState(false);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setStartTime(tpl.startTime);
      setEndTime(tpl.endTime);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (userId) {
      try {
        const check = await shiftsApi.checkLimits({
          userId,
          weekId,
          startTime,
          endTime,
          excludeShiftId: shift.id,
        });
        if (check.exceeds) {
          const ok = window.confirm(
            `⚠️ Превышение рабочей недели\n\n` +
              `${check.userName} уже работает ${check.currentHours} ч (без этой смены).\n` +
              `С этой сменой (${check.newShiftHours} ч) станет ${check.totalHours} ч.\n` +
              `Это на ${check.excess} ч больше нормы (${check.limit} ч).\n\n` +
              `Всё равно сохранить?`
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }

      try {
        const { onVacation, vacation } = await vacationsApi.check(
          userId,
          shiftDate
        );
        if (onVacation) {
          const userName =
            users.find((u) => u.id === userId)?.name ?? "Сотрудник";
          const ok = window.confirm(
            `⚠️ ${userName} в отпуске (${vacation!.startDate}–${
              vacation!.endDate
            }).\n\nВсё равно сохранить смену на ${shiftDate}?`
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    setBusy(true);
    try {
      await onUpdate(shift.id, {
        templateId: templateId || null,
        userId: userId || null,
        shiftDate,
        startTime,
        endTime,
      });
      onClose();
    } catch (e: any) {
      window.alert(e.response?.data?.error ?? "Ошибка сохранения");
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
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Редактировать смену
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Измените время, шаблон или сотрудника
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Дата
            </label>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Шаблон
            </label>
            <select
              value={templateId}
              onChange={(e) => onTemplateChange(e.target.value)}
            >
              <option value="">Без шаблона</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.startTime}–{t.endTime})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Сотрудник
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Не назначен</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Начало
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Конец
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-all"
            >
              {busy ? "Сохранение..." : "Сохранить"}
            </button>

            <button
              type="button"
              onClick={() => onDelete(shift.id)}
              className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Удалить
            </button>

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