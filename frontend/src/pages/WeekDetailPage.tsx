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
  Bell,
} from "lucide-react";
import { useWeeks } from "../store/weeks";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useUsers } from "../store/users";
import { useNotifications } from "../store/notifications";
import { vacationsApi } from "../api/vacations";
import { shiftsApi, type ScheduledShift } from "../api/weeks";
import {
  shiftChangeRequestsApi,
  type ShiftChangeRequest,
} from "../api/shiftChangeRequests";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import { weekDates, dayLabel, shortDate, fullDate } from "../lib/dates";
import { validateShiftTimes } from "../lib/time";

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

  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const [editingShift, setEditingShift] = useState<ScheduledShift | null>(null);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [incomingShiftRequests, setIncomingShiftRequests] = useState<
    ShiftChangeRequest[]
  >([]);
  const [outgoingShiftRequests, setOutgoingShiftRequests] = useState<
    ShiftChangeRequest[]
  >([]);
  const [moderating, setModerating] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchWeek(id);
    fetchTemplates();
    fetchUsers();
    shiftChangeRequestsApi
      .incoming()
      .then(setIncomingShiftRequests)
      .catch(() => setIncomingShiftRequests([]));
    shiftChangeRequestsApi
      .outgoing()
      .then(setOutgoingShiftRequests)
      .catch(() => setOutgoingShiftRequests([]));
  }, [id, fetchWeek, fetchTemplates, fetchUsers]);

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

  const pendingIncomingByShift = new Map<string, ShiftChangeRequest>();
  for (const r of incomingShiftRequests) {
    if (r.status === "PENDING" && r.shiftId) pendingIncomingByShift.set(r.shiftId, r);
  }


  const pendingOutgoingByShift = new Map<string, ShiftChangeRequest>();
  for (const r of outgoingShiftRequests) {
    if (r.status === "PENDING" && r.shiftId) pendingOutgoingByShift.set(r.shiftId, r);
  }

  for (const d of dates) shiftsByDate[d] = [];
  for (const s of currentWeek.shifts ?? []) {
    const d = String(s.shiftDate).slice(0, 10);
    if (shiftsByDate[d]) shiftsByDate[d].push(s);
  }

    // Виртуальные CREATE-смены (менеджер предложил, ждём согласования сотрудника)
  const virtualCreateByDate: Record<string, ShiftChangeRequest[]> = {};
  for (const r of incomingShiftRequests) {
    if (r.status === "PENDING" && r.kind === "CREATE") {
      const d = String(r.newShiftDate).slice(0, 10);
      if (!virtualCreateByDate[d]) virtualCreateByDate[d] = [];
      virtualCreateByDate[d].push(r);
    }
  }

  // Виртуальные CREATE-смены, КОТОРЫЕ СОЗДАЛ МЕНЕДЖЕР (для его календаря)
  // Эти запросы ждут согласования сотрудника
  const virtualCreateOutgoingByDate: Record<string, ShiftChangeRequest[]> = {};
  for (const r of outgoingShiftRequests) {
    if (
      r.status === "PENDING" &&
      r.kind === "CREATE" &&
      r.weekId === currentWeek.id
    ) {
      const d = String(r.newShiftDate).slice(0, 10);
      if (!virtualCreateOutgoingByDate[d]) virtualCreateOutgoingByDate[d] = [];
      virtualCreateOutgoingByDate[d].push(r);
    }
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
    // ─── Проверка времени ───
    const timeCheck = validateShiftTimes(form.startTime, form.endTime);
    if (!timeCheck.ok) {
      await alertDialog(timeCheck.message ?? "Неверное время смены", {
        title: "Ошибка в времени",
        variant: "error",
      });
      return;
    }

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
          const ok = await confirmDialog(
            `${userName} находится в отпуске с ${vacation!.startDate} по ${
              vacation!.endDate
            }.\n\nВсё равно назначить смену на ${date}?`,
            {
              title: "Сотрудник в отпуске",
              confirmLabel: "Назначить",
              variant: "danger",
            }
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
          const ok = await confirmDialog(
            `Превышение рабочей недели\n\n` +
              `${check.userName} уже работает ${check.currentHours} ч за эту неделю.\n` +
              `После добавления смены (${check.newShiftHours} ч) станет ${check.totalHours} ч.\n` +
              `Это на ${check.excess} ч больше нормы (${check.limit} ч).\n\n` +
              `Всё равно добавить?`,
            {
              title: "Превышение нормы",
              confirmLabel: "Добавить",
              variant: "danger",
            }
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    try {
      const result = await addShift({
        weekId: currentWeek.id,
        templateId: form.templateId || undefined,
        userId: form.userId || undefined,
        shiftDate: date,
        startTime: form.startTime,
        endTime: form.endTime,
      });

      if (result.kind === "requested") {
        await refreshShiftRequests();
        await alertDialog(
          "Смена добавлена на согласование сотруднику — он должен подтвердить",
          { title: "На согласовании", variant: "success" }
        );
      }

      setShowAddFor(null);
      setForm({
        templateId: "",
        userId: "",
        startTime: "09:00",
        endTime: "18:00",
      });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка создания смены", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const onRemoveShift = async (shiftId: string) => {
    const ok = await confirmDialog("Удалить смену?", {
      title: "Удаление смены",
      confirmLabel: "Удалить",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await removeShift(shiftId);
      if (editingShift?.id === shiftId) setEditingShift(null);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка удаления", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      const result = await publishWeek(currentWeek.id);
      if (!result.ok) {
        await alertDialog(
          "Нарушения ТК РФ:\n\n" + (result.violations ?? []).join("\n"),
          {
            title: "Нельзя опубликовать",
            variant: "error",
          }
        );
      } else {
        await alertDialog("Неделя опубликована!", {
          title: "Готово",
          variant: "success",
        });
        setEditMode(false);
      }
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка публикации", {
        title: "Ошибка",
        variant: "error",
      });
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
      await alertDialog(e.response?.data?.error ?? "Ошибка копирования", {
        title: "Ошибка",
        variant: "error",
      });
    } finally {
      setDuplicating(false);
    }
  };

  const onCopyDay = async (date: string) => {
    const shifts = shiftsByDate[date] ?? [];
    if (shifts.length === 0) {
      await alertDialog("В этом дне нет смен для копирования", {
        variant: "error",
      });
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
          const ok = await confirmDialog(
            `${userName} в отпуске (${vacation!.startDate}–${
              vacation!.endDate
            }).\n\nВсё равно вставить эту смену на ${date}?`,
            {
              title: "Сотрудник в отпуске",
              confirmLabel: "Вставить",
              variant: "danger",
            }
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
      await alertDialog(`Вставлено: ${success}, с ошибками: ${failed}`, {
        title: "Частичный успех",
        variant: "error",
      });
    }
  };

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
          const ok = await confirmDialog(
            `У сотрудника уже превышение рабочей недели: ${check.currentHours} ч при норме ${check.limit} ч.\n\nВсё равно перенести смену на ${newDate}?`,
            {
              title: "Превышение нормы",
              confirmLabel: "Перенести",
              variant: "danger",
            }
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
          const ok = await confirmDialog(
            `${userName} находится в отпуске с ${vacation!.startDate} по ${
              vacation!.endDate
            }.\n\nВсё равно перенести смену на ${newDate}?`,
            {
              title: "Сотрудник в отпуске",
              confirmLabel: "Перенести",
              variant: "danger",
            }
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    try {
      const result = await updateShift(shift.id, { shiftDate: newDate });
      if (result.kind === "requested") {
        await refreshShiftRequests();
        await alertDialog(
          "Изменение отправлено на согласование сотруднику — он должен подтвердить",
          { title: "На согласовании", variant: "success" }
        );
      }
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка переноса", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const onDayClick = (date: string) => {
    if (editMode) return;
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const onApproveShiftChange = async (requestId: string) => {
    setModerating(requestId);
    try {
      await shiftChangeRequestsApi.approve(requestId);
      const [inc, out] = await Promise.all([
        shiftChangeRequestsApi.incoming(),
        shiftChangeRequestsApi.outgoing(),
      ]);
      setIncomingShiftRequests(inc);
      setOutgoingShiftRequests(out);
      // ⚡ мгновенно сбрасываем бейджи в NavBar
      useNotifications.getState().refresh();
      if (id) await fetchWeek(id);
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка", {
        title: "Ошибка",
        variant: "error",
      });
    } finally {
      setModerating(null);
    }
  };

  const onRejectShiftChange = async (requestId: string) => {
    const ok = await confirmDialog("Отклонить изменение смены?", {
      title: "Отклонение",
      confirmLabel: "Отклонить",
      variant: "danger",
    });
    if (!ok) return;

    setModerating(requestId);
    try {
      await shiftChangeRequestsApi.reject(requestId);
      const [inc, out] = await Promise.all([
        shiftChangeRequestsApi.incoming(),
        shiftChangeRequestsApi.outgoing(),
      ]);
      setIncomingShiftRequests(inc);
      setOutgoingShiftRequests(out);
      useNotifications.getState().refresh();
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка", {
        title: "Ошибка",
        variant: "error",
      });
    } finally {
      setModerating(null);
    }
  };

  const refreshShiftRequests = async () => {
    const [inc, out] = await Promise.all([
      shiftChangeRequestsApi.incoming().catch(() => []),
      shiftChangeRequestsApi.outgoing().catch(() => []),
    ]);
    setIncomingShiftRequests(inc);
    setOutgoingShiftRequests(out);
    useNotifications.getState().refresh();
  };

  const userById = (uid: string | null) =>
    uid ? users.find((u) => u.id === uid)?.name ?? "—" : "Не назначен";

  const templateById = (tid: string | null) =>
    tid ? templates.find((t) => t.id === tid) : undefined;

  const totalShifts = currentWeek.shifts?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            {weekStart} — {weekEnd}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Неделя с {fullDate(currentWeek.weekStartDate)} · {totalShifts} смен
          </p>
        </div>

        {incomingShiftRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-amber-900">
                  Сотрудники предлагают изменения
                </h2>
                <p className="text-xs text-amber-700">
                  Проверьте и одобрите — после этого смена изменится
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                {incomingShiftRequests.length}
              </span>
            </div>

            <div className="space-y-2">
              {incomingShiftRequests.map((r) => {
                const busy = moderating === r.id;
                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-xl border border-amber-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-sm">
                          {r.requestedByName ?? "Сотрудник"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {r.kind === "CREATE"
                            ? "предлагает добавить смену"
                            : "предлагает изменить смену"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onApproveShiftChange(r.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {busy ? "..." : "Принять"}
                        </button>
                        <button
                          onClick={() => onRejectShiftChange(r.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Отклонить
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {r.kind !== "CREATE" && (
                        <div className="bg-slate-50 rounded-lg p-3 opacity-60 border border-slate-200">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                            Было
                          </div>
                          <div className="text-sm text-slate-700 line-through">
                            {r.oldShiftDate.slice(0, 10)} · {r.oldStartTime}–{r.oldEndTime}
                          </div>
                          {r.oldUserName && (
                            <div className="text-xs text-slate-500 mt-0.5 line-through">
                              {r.oldUserName}
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={`bg-emerald-50 rounded-lg p-3 border-2 border-emerald-300 ${
                          r.kind === "CREATE" ? "md:col-span-2" : ""
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                          {r.kind === "CREATE" ? "Новая смена" : "Стало"}
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          {r.newShiftDate.slice(0, 10)} · {r.newStartTime}–{r.newEndTime}
                        </div>
                        {r.newUserName && (
                          <div className="text-xs text-slate-600 mt-0.5">
                            {r.newUserName}
                          </div>
                        )}
                      </div>
                    </div>      
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                {isDraft && (
                  <>
                    {" "}
                    · В черновике изменения применяются сразу.
                  </>
                )}
                {!isDraft && (
                  <>
                    {" "}
                    · Неделя опубликована — изменения уйдут на согласование
                    сотрудникам.
                  </>
                )}
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

        {!editMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 flex items-center gap-3 text-xs text-blue-800">
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span>
              Нажмите на любой день, чтобы развернуть его и увидеть все смены
              в одну линию. Повторный клик — свернуть.
            </span>
          </div>
        )}

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
                } hover:border-slate-300`}
                style={{
                  flexGrow: isExpanded ? 3 : 1,
                  flexShrink: 1,
                  flexBasis: "0%",
                  minWidth: 0,
                }}
              >
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
                    const pendingInc = pendingIncomingByShift.get(s.id);
                    const pendingOut = pendingOutgoingByShift.get(s.id);
                    const pending = pendingInc ?? pendingOut;
                    const hasPending = !!pending;

                    const oldDate = String(s.shiftDate).slice(0, 10);
                    const newDate = pending ? pending.newShiftDate.slice(0, 10) : oldDate;
                    const dateChanged = hasPending && oldDate !== newDate;

                    const timeChanged =
                      hasPending &&
                      (s.startTime !== pending!.newStartTime ||
                        s.endTime !== pending!.newEndTime);

                    const userChanged = hasPending && s.userId !== pending!.newUserId;
                    const oldUserName = userById(s.userId);
                    const newUserName = hasPending
                      ? userById(pending!.newUserId)
                      : oldUserName;

                    return (
                      <div
                        key={s.id}
                        draggable={canEdit && !hasPending}
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onDragEnd={onDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canEdit) return;
                          if (draggingShiftId) return;
                          if (hasPending) {
                            alertDialog("Смена на согласовании — сначала дождитесь ответа", {
                              variant: "error",
                            });
                            return;
                          }
                          setEditingShift(s);
                        }}
                        className={`group relative rounded-lg border-l-4 transition-all ${
                          isExpanded
                            ? "flex-1 min-w-[140px] text-[11px] p-1.5"
                            : "text-xs p-2"
                        } ${hasPending ? "ring-2 ring-amber-300/60" : ""} ${
                          canEdit && !hasPending
                            ? "cursor-pointer active:cursor-grabbing hover:ring-2 hover:ring-offset-1 hover:ring-brand-300"
                            : ""
                        } ${isDragging ? "opacity-30" : ""}`}
                        style={{
                          borderLeftColor: hasPending
                            ? pendingInc
                              ? "#F59E0B"
                              : "#94A3B8"
                            : color,
                          backgroundColor: hasPending
                            ? pendingInc
                              ? "#FEF3C7"
                              : "#F1F5F9"
                            : color + "10",
                        }}
                      >
                        {/* Время: старое → новое */}
                        <div className="flex items-center gap-1 font-medium text-slate-900 flex-wrap">
                          {canEdit && !hasPending && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{ color: hasPending ? "#B45309" : color }}
                          />
                          {timeChanged ? (
                            <>
                              <span className="line-through text-slate-400">
                                {s.startTime}–{s.endTime}
                              </span>
                              <span className="text-slate-400 text-[10px]">→</span>
                              <span className="text-amber-800 font-semibold">
                                {pending!.newStartTime}–{pending!.newEndTime}
                              </span>
                            </>
                          ) : (
                            <span>
                              {s.startTime}–{s.endTime}
                            </span>
                          )}
                        </div>

                        {/* Сотрудник: старый → новый */}
                        <div className="truncate mt-0.5">
                          {userChanged ? (
                            <span className="flex items-center gap-1 flex-wrap">
                              <span className="line-through text-slate-400">
                                {oldUserName}
                              </span>
                              <span className="text-slate-400 text-[10px]">→</span>
                              <span className="text-amber-800 font-medium">
                                {newUserName}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-600">{userById(s.userId)}</span>
                          )}
                        </div>

                        {/* Шаблон — только если не развёрнуто */}
                        {tpl && !isExpanded && (
                          <div className="text-slate-400 truncate mt-0.5">{tpl.name}</div>
                        )}

                        {/* Дата: старая → новая (если перенос в другой день) */}
                        {dateChanged && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] flex-wrap">
                            <CalendarDays className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="line-through text-slate-400">
                              {shortDate(oldDate)}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-amber-800 font-semibold">
                              {shortDate(newDate)}
                            </span>
                          </div>
                        )}

                        {/* Плашка статуса */}
                        {pendingInc && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 leading-tight">
                            <Bell className="w-3 h-3 shrink-0" />
                            <span>Требует вашего решения</span>
                          </div>
                        )}
                        {pendingOut && !pendingInc && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 leading-tight">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>Ждёт согласования сотрудника</span>
                          </div>
                        )}

                        {/* Кнопка удаления */}
                        {canEdit && !hasPending && (
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

                  {/* Виртуальные CREATE-смены — ждут согласования */}
                  {(virtualCreateByDate[date] ?? []).map((r) => {
                    const tpl = templateById(r.templateId ?? null);
                    
                    return (
                      <div
                        key={`virtual-create-${r.id}`}
                        className="group relative rounded-lg border-l-4 border-amber-500 bg-amber-50 ring-2 ring-amber-300/60 text-xs p-2"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 flex-wrap">
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{ color: "#B45309" }}
                          />
                          <span>
                            {r.newStartTime}–{r.newEndTime}
                          </span>
                        </div>
                        <div className="text-slate-600 truncate mt-0.5">
                          {userById(r.newUserId)}
                        </div>
                        {tpl && (
                          <div className="text-slate-400 truncate mt-0.5">{tpl.name}</div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 leading-tight">
                          <Bell className="w-3 h-3 shrink-0" />
                          <span>На согласовании</span>
                        </div>
                        {r.requestedByName && (
                          <div className="mt-1 text-[10px] text-slate-500">
                            от {r.requestedByName}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Виртуальные CREATE от менеджера — ждут согласования сотрудника */}
                  {(virtualCreateOutgoingByDate[date] ?? []).map((r) => {
                    const tpl = templateById(r.templateId ?? null);
                    return (
                      <div
                        key={`virtual-create-out-${r.id}`}
                        className="rounded-lg border-l-4 border-amber-500 bg-amber-50 ring-2 ring-amber-300/60 text-xs p-2"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 flex-wrap">
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{ color: "#B45309" }}
                          />
                          <span>
                            {r.newStartTime}–{r.newEndTime}
                          </span>
                        </div>
                        <div className="text-slate-600 truncate mt-0.5">
                          {userById(r.newUserId)}
                        </div>
                        {tpl && (
                          <div className="text-slate-400 truncate mt-0.5">{tpl.name}</div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 leading-tight">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Ждёт согласования сотрудника</span>
                        </div>
                      </div>
                    );
                  })}

                {dayShifts.length === 0 &&
                  (virtualCreateByDate[date] ?? []).length === 0 &&
                  (virtualCreateOutgoingByDate[date] ?? []).length === 0 && (
                  <div
                    className={`text-xs text-center ${
                      isExpanded ? "py-6" : "py-4"
                    } ${
                      isDragOver ? "text-brand-500 font-medium" : "text-slate-300"
                    }`}
                  >
                    {isDragOver ? "отпустите здесь" : "нет смен"}
                  </div>
                )}
                </div>

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
          onRequestCreated={refreshShiftRequests}
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
  onRequestCreated,
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
  ) => Promise<{
    kind: "applied" | "requested";
    shift?: ScheduledShift;
    request?: any;
  }>;
  onDelete: (id: string) => Promise<void>;
  onRequestCreated?: () => Promise<void> | void;
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

    // ─── Проверка времени ───
    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok) {
      await alertDialog(timeCheck.message ?? "Неверное время смены", {
        title: "Ошибка в времени",
        variant: "error",
      });
      return;
    }

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
          const ok = await confirmDialog(
            `Превышение рабочей недели\n\n` +
              `${check.userName} уже работает ${check.currentHours} ч (без этой смены).\n` +
              `С этой сменой (${check.newShiftHours} ч) станет ${check.totalHours} ч.\n` +
              `Это на ${check.excess} ч больше нормы (${check.limit} ч).\n\n` +
              `Всё равно сохранить?`,
            {
              title: "Превышение нормы",
              confirmLabel: "Сохранить",
              variant: "danger",
            }
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
          const ok = await confirmDialog(
            `${userName} в отпуске (${vacation!.startDate}–${
              vacation!.endDate
            }).\n\nВсё равно сохранить смену на ${shiftDate}?`,
            {
              title: "Сотрудник в отпуске",
              confirmLabel: "Сохранить",
              variant: "danger",
            }
          );
          if (!ok) return;
        }
      } catch {
        // ignore
      }
    }

    setBusy(true);
    try {
      const result = await onUpdate(shift.id, {
        templateId: templateId || null,
        userId: userId || null,
        shiftDate,
        startTime,
        endTime,
      });

      if (result?.kind === "requested") {
        if (onRequestCreated) await onRequestCreated();
        await alertDialog(
          "Изменение отправлено на согласование сотруднику — он должен подтвердить",
          { title: "На согласовании", variant: "success" }
        );
      } else {
        await alertDialog("Смена обновлена", {
          title: "Готово",
          variant: "success",
        });
      }

      onClose();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка сохранения", {
        title: "Ошибка",
        variant: "error",
      });
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