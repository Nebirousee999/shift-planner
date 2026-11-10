import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Copy, CheckCircle2, Plus, X, Trash2, Clock, CalendarDays,
  AlertCircle, Pencil, Check, ClipboardPaste, Clipboard, GripVertical,
  Maximize2, Minimize2, Bell, Wallet, CalendarX2, Stethoscope,
} from "lucide-react";
import { useWeeks } from "../store/weeks";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useUsers } from "../store/users";
import { useVacations } from "../store/vacations";
import { useSickLeaves } from "../store/sickLeaves";
import { useNotifications } from "../store/notifications";
import { useLocations } from "../store/locations";
import { useAreas } from "../store/areas";
import { usePositions } from "../store/positions";
import { useOrganization } from "../store/organization";
import { useTimeOff } from "../store/timeOff";
import { vacationsApi } from "../api/vacations";
import { shiftsApi, type ScheduledShift } from "../api/weeks";
import {
  shiftChangeRequestsApi,
  type ShiftChangeRequest,
} from "../api/shiftChangeRequests";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import TeamSummary from "../components/TeamSummary";
import { weekDates, dayLabel, shortDate, fullDate } from "../lib/dates";
import { validateShiftTimes } from "../lib/time";

type ShiftSnapshot = {
  templateId: string | null;
  userId: string | null;
  startTime: string;
  endTime: string;
};

const calcHours = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
};
const formatMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";

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
  const { all: vacations, fetchAll: fetchVacations } = useVacations();
  const { all: sickLeaves, fetchAll: fetchSickLeaves } = useSickLeaves();
  const {
    items: locations,
    activeLocationId,
    fetch: fetchLocations,
  } = useLocations();
  const { items: areas, fetch: fetchAreas } = useAreas();
  const { items: positions, fetch: fetchPositions } = usePositions();
  const {
    items: timeOffs,
    fetch: fetchTimeOffs,
    approve: approveTimeOff,
    reject: rejectTimeOff,
  } = useTimeOff();
  const org = useOrganization((s) => s.org);

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

  const [clipboardDay, setClipboardDay] = useState<ShiftSnapshot[]>([]);
  const [clipboardShift, setClipboardShift] = useState<ShiftSnapshot | null>(
    null
  );

  const [pasteBusy, setPasteBusy] = useState<string | null>(null);
  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<ScheduledShift | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [incomingShiftRequests, setIncomingShiftRequests] = useState<
             ShiftChangeRequest[]
           >([]);
           const [hoveredRequestId, setHoveredRequestId] = useState<string | null>(null);
  const [outgoingShiftRequests, setOutgoingShiftRequests] = useState<
    ShiftChangeRequest[]
  >([]);
  const [moderating, setModerating] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchWeek(id);
    fetchTemplates();
    fetchUsers();
    fetchVacations();
    fetchSickLeaves();
    fetchLocations();
    fetchAreas();
    fetchPositions();
    fetchTimeOffs();
    shiftChangeRequestsApi
      .incoming()
      .then(setIncomingShiftRequests)
      .catch(() => setIncomingShiftRequests([]));
    shiftChangeRequestsApi
      .outgoing()
      .then(setOutgoingShiftRequests)
      .catch(() => setOutgoingShiftRequests([]));
  }, [
    id,
    fetchWeek,
    fetchTemplates,
    fetchUsers,
    fetchVacations,
    fetchSickLeaves,
    fetchLocations,
    fetchAreas,
    fetchPositions,
    fetchTimeOffs,
  ]);

  useEffect(() => {
    if (editMode) setExpandedDate(null);
  }, [editMode]);

  // ═════════════════════════════════════════════════════════
  // СВОДКА: только активная точка
  // ═════════════════════════════════════════════════════════
  const summaryUsers = useMemo(() => {
    if (!activeLocationId) return users;
    return users.filter((u) => (u.locationIds ?? []).includes(activeLocationId));
  }, [users, activeLocationId]);

  const summaryAreas = useMemo(() => {
    if (!activeLocationId) return areas;
    return areas.filter((a) => a.locationId === activeLocationId);
  }, [areas, activeLocationId]);

  const positionsForSummary = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    positions.forEach((p) =>
      map.set(p.name, { id: p.id, name: p.name, color: p.color })
    );
    summaryUsers.forEach((u) => {
      if (u.position && !map.has(u.position)) {
        map.set(u.position, {
          id: `tmp-${u.position}`,
          name: u.position,
          color: "#64748B",
        });
      }
    });
    return Array.from(map.values());
  }, [positions, summaryUsers]);

  if (loading && !currentWeek)
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-slate-500 text-sm">Загрузка...</p>
        </main>
      </div>
    );
  if (error || !currentWeek)
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-500 text-sm">{error ?? "Неделя не найдена"}</p>
        </main>
      </div>
    );

  const isDraft = currentWeek.status === "DRAFT";
  const isLocked = currentWeek.status === "LOCKED";
  const canEdit = editMode && !isLocked;
  const dates = weekDates(currentWeek.weekStartDate);
  const weekStart = shortDate(dates[0]);
  const weekEnd = shortDate(dates[6]);
  const shiftsByDate: Record<string, typeof currentWeek.shifts> = {};

  const pendingIncomingByShift = new Map<string, ShiftChangeRequest>();
           for (const r of incomingShiftRequests) {
             if (r.status === "PENDING" && r.shiftId)
               pendingIncomingByShift.set(r.shiftId, r);
           }

           const highlightedShiftId = hoveredRequestId
             ? incomingShiftRequests.find((r) => r.id === hoveredRequestId)?.shiftId ?? null
             : null;

  const pendingOutgoingByShift = new Map<string, ShiftChangeRequest>();
  for (const r of outgoingShiftRequests) {
    if (r.status === "PENDING" && r.shiftId)
      pendingOutgoingByShift.set(r.shiftId, r);
  }

  for (const d of dates) shiftsByDate[d] = [];
  for (const s of currentWeek.shifts ?? []) {
    const d = String(s.shiftDate).slice(0, 10);
    if (shiftsByDate[d]) shiftsByDate[d].push(s);
  }

  // ─── Отгулы, попадающие в диапазон этой недели ───
  const weekTimeOffs = timeOffs.filter(
    (t) =>
      t.status === "PENDING" && dates.includes(String(t.date).slice(0, 10))
  );

  const virtualCreateByDate: Record<string, ShiftChangeRequest[]> = {};
  for (const r of incomingShiftRequests) {
    if (r.status === "PENDING" && r.kind === "CREATE") {
      const d = String(r.newShiftDate).slice(0, 10);
      if (!virtualCreateByDate[d]) virtualCreateByDate[d] = [];
      virtualCreateByDate[d].push(r);
    }
  }
  const virtualCreateOutgoingByDate: Record<string, ShiftChangeRequest[]> = {};
  for (const r of outgoingShiftRequests) {
    if (r.status === "PENDING" && r.kind === "CREATE" && r.weekId === currentWeek.id) {
      const d = String(r.newShiftDate).slice(0, 10);
      if (!virtualCreateOutgoingByDate[d]) virtualCreateOutgoingByDate[d] = [];
      virtualCreateOutgoingByDate[d].push(r);
    }
  }

  const userStats = summaryUsers.map((u) => {
    const uShiftsWeek = currentWeek.shifts?.filter((s) => s.userId === u.id) || [];
    const weekHours = uShiftsWeek.reduce(
      (acc, s) => acc + calcHours(s.startTime, s.endTime),
      0
    );
    const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
    const weekCost = weekHours * rate;

    const todayStr = new Date().toISOString().slice(0, 10);
    const isVacation = vacations.some(
      (v) => v.userId === u.id && v.startDate <= todayStr && v.endDate >= todayStr
    );
    const isSick = sickLeaves.some(
      (s) => s.userId === u.id && s.startDate <= todayStr && s.endDate >= todayStr
    );
    const status = isSick ? "Больничный" : isVacation ? "Отпуск" : "Свободен";

    return { ...u, weekHours, weekShiftsCount: uShiftsWeek.length, weekCost, status };
  });

  const weeklyCost = userStats.reduce((acc, u) => acc + u.weekCost, 0);
  const totalWeekShifts = currentWeek.shifts?.length ?? 0;

  // ═════════════════════════════════════════════════════════
  // Действия со сменами
  // ═════════════════════════════════════════════════════════
  const onTemplateChange = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    setForm((f) => ({
      ...f,
      templateId,
      ...(tpl ? { startTime: tpl.startTime, endTime: tpl.endTime } : {}),
    }));
  };

  const onAddShift = async (date: string, snapshot?: ShiftSnapshot) => {
    const startTime = snapshot ? snapshot.startTime : form.startTime;
    const endTime = snapshot ? snapshot.endTime : form.endTime;
    const userId = snapshot ? snapshot.userId : form.userId;
    const templateId = snapshot ? snapshot.templateId : form.templateId;

    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok)
      return alertDialog(timeCheck.message ?? "Неверное время", {
        title: "Ошибка",
        variant: "error",
      });

    if (userId) {
      setCheckingVacation(true);
      try {
        const { onVacation, vacation } = await vacationsApi.check(userId, date);
        if (onVacation) {
          const userName = users.find((u) => u.id === userId)?.name ?? "Сотрудник";
          const ok = await confirmDialog(
            `${userName} находится в отпуске с ${vacation!.startDate} по ${vacation!.endDate}.\n\nВсё равно назначить смену?`,
            { title: "В отпуске", confirmLabel: "Назначить", variant: "danger" }
          );
          if (!ok) {
            setCheckingVacation(false);
            return;
          }
        }
      } catch {
        /* ignore */
      } finally {
        setCheckingVacation(false);
      }
    }

    if (userId) {
      try {
        const check = await shiftsApi.checkLimits({
          userId,
          weekId: currentWeek.id,
          startTime,
          endTime,
        });
        if (check.exceeds) {
          const ok = await confirmDialog(
            `Превышение рабочей недели\n\n${check.userName} уже работает ${check.currentHours} ч. Станет ${check.totalHours} ч (норма ${check.limit} ч).\n\nВсё равно добавить?`,
            { title: "Превышение", confirmLabel: "Добавить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const result = await addShift({
        weekId: currentWeek.id,
        templateId: templateId || undefined,
        userId: userId || undefined,
        shiftDate: date,
        startTime,
        endTime,
      });
      if (result.kind === "requested") {
        await refreshShiftRequests();
        await alertDialog("Смена добавлена на согласование сотруднику", {
          title: "На согласовании",
          variant: "success",
        });
      }
      if (!snapshot) {
        setShowAddFor(null);
        setForm({ templateId: "", userId: "", startTime: "09:00", endTime: "18:00" });
      }
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка создания", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const onRemoveShift = async (shiftId: string) => {
    const ok = await confirmDialog("Удалить смену?", {
      title: "Удаление",
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
      if (!result.ok)
        await alertDialog(
          "Нарушения ТК РФ:\n\n" + (result.violations ?? []).join("\n"),
          { title: "Нельзя опубликовать", variant: "error" }
        );
      else {
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
    if (shifts.length === 0)
      return alertDialog("В этом дне нет смен", { variant: "error" });
    setClipboardDay(
      shifts.map((s) => ({
        templateId: s.templateId,
        userId: s.userId,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
    );
    setClipboardShift(null);
  };

  const onCopyShift = (shift: any) => {
    setClipboardShift({
      templateId: shift.templateId,
      userId: shift.userId,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
    setClipboardDay([]);
  };

  const onPasteDay = async (date: string) => {
    if (clipboardDay.length === 0) return;
    setPasteBusy(date);
    for (const snap of clipboardDay) {
      await onAddShift(date, snap);
    }
    setPasteBusy(null);
  };

  const onPasteShift = async (date: string) => {
    if (!clipboardShift) return;
    await onAddShift(date, clipboardShift);
    setClipboardShift(null);
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
    const shift = (currentWeek.shifts ?? []).find((s) => s.id === draggingShiftId);
    setDraggingShiftId(null);
    if (!shift) return;
    if (String(shift.shiftDate).slice(0, 10) === newDate) return;

    try {
      const result = await updateShift(shift.id, { shiftDate: newDate });
      if (result.kind === "requested") {
        await refreshShiftRequests();
        await alertDialog("Изменение отправлено на согласование", {
          title: "На согласовании",
          variant: "success",
        });
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
      useNotifications.getState().refresh();
      if (id) await fetchWeek(id);
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка", { title: "Ошибка", variant: "error" });
    } finally {
      setModerating(null);
    }
  };

  const onRejectShiftChange = async (requestId: string) => {
    const ok = await confirmDialog("Отклонить изменение?", {
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
      await alertDialog(e.message ?? "Ошибка", { title: "Ошибка", variant: "error" });
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

  const getUserInfo = (uid: string | null) => {
    const u = users.find((x) => x.id === uid);
    return u ? { name: u.name, position: u.position } : { name: "—", position: null };
  };
  const templateById = (tid: string | null) =>
    tid ? templates.find((t) => t.id === tid) : undefined;

  const getUserStatus = (userId: string, dateStr: string) => {
    const isSick = sickLeaves.some(
      (s) => s.userId === userId && s.startDate <= dateStr && s.endDate >= dateStr
    );
    if (isSick) return "Больничный";
    const isVacation = vacations.some(
      (v) => v.userId === userId && v.startDate <= dateStr && v.endDate >= dateStr
    );
    if (isVacation) return "Отпуск";
    return "Свободен";
  };

  // ═════════════════════════════════════════════════════════
  // Действия с отгулами (внутри карточки смены и в нижнем баннере)
  // ═════════════════════════════════════════════════════════
  const handleApproveTimeOff = async (timeOffId: string) => {
    try {
      await approveTimeOff(timeOffId);
      if (currentWeek?.id) await fetchWeek(currentWeek.id);
      useNotifications.getState().refresh();
      await alertDialog("Отгул одобрен — смена снята", {
        variant: "success",
      });
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка", { variant: "error" });
    }
  };

  const handleRejectTimeOff = async (timeOffId: string) => {
    const ok = await confirmDialog("Отклонить запрос на отгул?", {
      title: "Отклонение",
      confirmLabel: "Отклонить",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await rejectTimeOff(timeOffId);
      useNotifications.getState().refresh();
      await alertDialog("Запрос на отгул отклонён", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка", { variant: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Шапка */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <button
            onClick={() => navigate("/weeks")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> К списку недель
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {!isLocked && (
              <button
                onClick={() => {
                  setEditMode((v) => !v);
                  if (editMode) {
                    setShowAddFor(null);
                    setClipboardDay([]);
                    setClipboardShift(null);
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
                    <Check className="w-4 h-4" /> Готово
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" /> Редактировать
                  </>
                )}
              </button>
            )}
            <button
              onClick={onDuplicate}
              disabled={duplicating}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-all"
            >
              <Copy className="w-4 h-4" /> {duplicating ? "..." : "Скопировать"}
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
                  <CheckCircle2 className="w-3.5 h-3.5" /> Опубликован
                </>
              )}
            </span>
            {isDraft && (
              <button
                onClick={onPublish}
                disabled={publishing}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />{" "}
                {publishing ? "..." : "Опубликовать"}
              </button>
            )}
          </div>
        </div>

        {/* Заголовок недели */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {weekStart} — {weekEnd}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Неделя с {fullDate(currentWeek.weekStartDate)}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Всего смен
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {totalWeekShifts}
              </span>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Затраты за неделю
              </span>
              <span className="text-2xl font-bold text-emerald-600">
                {formatMoney(weeklyCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Сводка */}
        <div className="mb-6">
          <TeamSummary
            users={summaryUsers}
            areas={summaryAreas}
            positions={positionsForSummary}
            getStat={(userId) => {
              const u = userStats.find((x) => x.id === userId);
              return {
                hours: Math.round((u?.weekHours ?? 0) * 10) / 10,
                shifts: u?.weekShiftsCount ?? 0,
                cost: u?.weekCost ?? 0,
              };
            }}
            statLabel="Неделя"
            statMax={40}
            headerOpacity={org?.positionHeaderOpacity ?? 70}
            rowOpacity={org?.positionRowOpacity ?? 20}
          />
        </div>

        {/* ─── Входящие запросы на изменение смен ─── */}
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
                <p className="text-xs text-amber-700">Проверьте и одобрите</p>
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
                             onMouseEnter={() => setHoveredRequestId(r.id)}
                             onMouseLeave={() => setHoveredRequestId(null)}
                           >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 text-sm">
                            {r.requestedByName ?? "Сотрудник"}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {r.kind === "CREATE"
                              ? "предлагает добавить смену"
                              : "предлагает изменить смену"}
                          </div>
                          <div className="mt-2 text-xs space-y-0.5">
                            {r.kind === "UPDATE" ? (
                              <>
                                <div className="text-slate-400 line-through">
                                  {r.oldShiftDate.slice(0, 10)} · {r.oldStartTime}–{r.oldEndTime}
                                  {r.oldUserName && ` · ${r.oldUserName}`}
                                </div>
                                <div className="text-slate-900 font-medium">
                                  {r.newShiftDate.slice(0, 10)} · {r.newStartTime}–{r.newEndTime}
                                  {r.newUserName && r.newUserName !== r.oldUserName && ` · ${r.newUserName}`}
                                </div>
                              </>
                            ) : (
                              <div className="text-slate-900 font-medium">
                                {r.newShiftDate.slice(0, 10)} · {r.newStartTime}–{r.newEndTime}
                                {r.newUserName && ` · ${r.newUserName}`}
                              </div>
                            )}
                          </div>
                        </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onApproveShiftChange(r.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />{" "}
                          {busy ? "..." : "Принять"}
                        </button>
                        <button
                          onClick={() => onRejectShiftChange(r.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Баннер режима редактирования ─── */}
        {editMode && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-start gap-3 animate-fade-in">
            <Pencil className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <div className="font-medium text-emerald-900">
                Режим редактирования
              </div>
              <div className="text-emerald-700 mt-0.5">
                Перетаскивайте смены между днями. Клик по смене — редактирование.
                {clipboardDay.length > 0 && " В буфере: день."}
                {clipboardShift && " В буфере: 1 смена."}
              </div>
            </div>
          </div>
        )}

        {/* ─── Сетка дней недели ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:flex lg:flex-row lg:items-stretch">
          {dates.map((date) => {
            const dayShifts = shiftsByDate[date] ?? [];
            const isToday = date === new Date().toISOString().slice(0, 10);
            const isPasting = pasteBusy === date;
            const isDragOver = dragOverDate === date;
            const isExpanded = !editMode && expandedDate === date;

            const dayCost = dayShifts.reduce((acc, s) => {
              const u = users.find((x) => x.id === s.userId);
              return (
                acc +
                calcHours(s.startTime, s.endTime) *
                  (u?.hourlyRate ? Number(u.hourlyRate) : 0)
              );
            }, 0);

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
                      <div className="flex items-center gap-1 bg-white rounded-md shadow-sm border border-slate-200 px-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyDay(date);
                          }}
                          disabled={dayShifts.length === 0}
                          className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 transition-colors"
                          title="Скопировать весь день"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPasteDay(date);
                          }}
                          disabled={clipboardDay.length === 0 || isPasting}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 transition-colors"
                          title="Вставить весь день"
                        >
                          {isPasting ? (
                            <span className="text-[10px]">...</span>
                          ) : (
                            <ClipboardPaste className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {clipboardShift && (
                          <>
                            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPasteShift(date);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Вставить одну смену"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 mt-1.5 bg-slate-100 px-2 py-0.5 rounded inline-block">
                    {dayShifts.length} см. • {formatMoney(dayCost)}
                  </div>
                </div>

                {/* Смены */}
                <div
                  className={`${
                    isExpanded ? "flex flex-wrap gap-2 content-start" : "space-y-2"
                  } flex-1`}
                >
                  {dayShifts.map((s) => {
                    const tpl = templateById(s.templateId);
                    const color = tpl?.color ?? "#3B82F6";
                    const isDragging = draggingShiftId === s.id;
                    const pendingInc = pendingIncomingByShift.get(s.id);
                    const pendingOut = pendingOutgoingByShift.get(s.id);
                    const pending = pendingInc ?? pendingOut;
                    const activeTimeOff = timeOffs.find(
                      (t) => t.shiftId === s.id && t.status === "PENDING"
                    );
                    const hasPending = !!pending;
                      const uInfo = getUserInfo(s.userId);
                      const oldDate = String(s.shiftDate).slice(0, 10);
                      const newDate = pending ? String(pending.newShiftDate).slice(0, 10) : oldDate;
                      const dateChanged = hasPending && oldDate !== newDate;
                      const timeChanged = hasPending && (
                        s.startTime !== pending!.newStartTime ||
                        s.endTime !== pending!.newEndTime
                      );

                    return (
                      <div
                        key={s.id}
                        draggable={canEdit && !hasPending && !activeTimeOff}
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onDragEnd={onDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canEdit) return;
                          if (draggingShiftId) return;
                          if (hasPending) {
                            alertDialog("Смена на согласовании", {
                              variant: "error",
                            });
                            return;
                          }
                          if (activeTimeOff) {
                            alertDialog("По смене висит запрос на отгул", {
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
                          activeTimeOff ? "ring-2 ring-amber-400/70" : ""
                        } ${
                          canEdit && !hasPending && !activeTimeOff
                            ? "cursor-pointer active:cursor-grabbing hover:ring-2 hover:ring-offset-1 hover:ring-brand-300"
                                     : ""
                                     } ${isDragging ? "opacity-30" : ""} ${
                                       highlightedShiftId === s.id
                                         ? "ring-4 ring-amber-500 shadow-xl scale-[1.03] z-20"
                                         : ""
                                     }`}
                        style={{
                          borderLeftColor: activeTimeOff ? "#f59e0b" : color,
                          backgroundColor: activeTimeOff
                            ? "#fef3c7"
                            : color + "10",
                        }}
                      >
                        <div className="flex items-center gap-1 font-medium text-slate-900 flex-wrap pr-6">
                          {canEdit && !hasPending && !activeTimeOff && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{
                              color: hasPending
                                ? "#B45309"
                                : activeTimeOff
                                ? "#B45309"
                                : color,
                            }}
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
                        <div className="flex flex-col mt-0.5">
                            <span className="text-slate-900 font-medium truncate">
                              {uInfo.name}
                            </span>
                            <span className="text-slate-500 text-[10px] truncate">
                              {uInfo.position || "—"}
                            </span>
                          </div>
                          {dateChanged && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] flex-wrap">
                              <CalendarDays className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="line-through text-slate-400">{shortDate(oldDate)}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-amber-800 font-semibold">{shortDate(newDate)}</span>
                            </div>
                          )}

                        {/* Плашка запроса на отгул внутри карточки смены */}
                        {activeTimeOff && (
                          <div
                            className="mt-2 p-2 bg-white rounded border border-amber-300 shadow-sm animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[11px] font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                              <CalendarX2 className="w-3.5 h-3.5" /> Запрос на
                              отгул
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveTimeOff(activeTimeOff.id);
                                }}
                                className="flex-1 bg-emerald-600 text-white text-[10px] py-1 rounded hover:bg-emerald-700 font-medium"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectTimeOff(activeTimeOff.id);
                                }}
                                className="flex-1 bg-rose-100 text-rose-700 text-[10px] py-1 rounded hover:bg-rose-200 font-medium"
                              >
                                Отклонить
                              </button>
                            </div>
                          </div>
                        )}

                        {canEdit && !hasPending && !activeTimeOff && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-white/90 rounded backdrop-blur-sm">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopyShift(s);
                              }}
                              className="text-slate-400 hover:text-brand-600 p-1 rounded transition-all"
                              title="Копировать смену"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveShift(s.id);
                              }}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition-all"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Виртуальные входящие CREATE */}
                  {(virtualCreateByDate[date] ?? []).map((r) => (
                             <div
                               key={`virt-inc-${r.id}`}
                               className={`group relative rounded-lg border-l-4 border-amber-500 bg-amber-50 ring-2 ring-amber-300/60 text-xs p-2 transition-all ${
                                 hoveredRequestId === r.id
                                   ? "ring-4 ring-amber-500 shadow-xl scale-[1.03] z-20"
                                   : ""
                               }`}
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
                      <div className="flex flex-col mt-0.5">
                        <span className="text-slate-900 font-medium truncate">
                          {getUserInfo(r.newUserId).name}
                        </span>
                        <span className="text-slate-500 text-[10px] truncate">
                          {getUserInfo(r.newUserId).position || "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 leading-tight">
                        <Bell className="w-3 h-3 shrink-0" />
                        <span>Ждёт вашего решения</span>
                      </div>
                    </div>
                  ))}

                  {/* Виртуальные исходящие CREATE */}
                  {(virtualCreateOutgoingByDate[date] ?? []).map((r) => (
                    <div
                      key={`virt-out-${r.id}`}
                      className="group relative rounded-lg border-l-4 border-amber-400 bg-amber-50 ring-2 ring-amber-200/50 text-xs p-2"
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
                      <div className="flex flex-col mt-0.5">
                        <span className="text-slate-900 font-medium truncate">
                          {getUserInfo(r.newUserId).name}
                        </span>
                        <span className="text-slate-500 text-[10px] truncate">
                          {getUserInfo(r.newUserId).position || "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5 leading-tight">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Ждёт согласования</span>
                      </div>
                    </div>
                  ))}

                  {dayShifts.length === 0 &&
                    (virtualCreateByDate[date] ?? []).length === 0 &&
                    (virtualCreateOutgoingByDate[date] ?? []).length === 0 && (
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

                {/* Кнопка «+ смена» */}
                {canEdit && showAddFor !== date && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddFor(date);
                    }}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-brand-600 hover:bg-brand-50 py-1.5 rounded-lg border border-dashed border-slate-200 hover:border-brand-300 transition-all"
                  >
                    <Plus className="w-3 h-3" /> смена
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
                        const status = getUserStatus(u.id, date);
                        return (
                          <option
                            key={u.id}
                            value={u.id}
                            className={
                              status === "Больничный"
                                ? "text-red-600"
                                : status === "Отпуск"
                                ? "text-amber-600"
                                : "text-slate-900"
                            }
                          >
                            {u.name} ({u.position || "—"}) — {status}
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex gap-1">
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startTime: e.target.value }))
                        }
                        className="!text-xs !px-1.5 !py-1"
                      />
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, endTime: e.target.value }))
                        }
                        className="!text-xs !px-1.5 !py-1"
                      />
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

        {/* ─── Нижний баннер: запросы на отгул по этой неделе ─── */}
        {weekTimeOffs.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mt-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <CalendarX2 className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-amber-900">
                  Запросы на отгул
                </h2>
                <p className="text-xs text-amber-700">
                  Одобрите — смена снимется, отклоните — останется
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                {weekTimeOffs.length}
              </span>
            </div>
            <div className="space-y-2">
              {weekTimeOffs.map((t) => {
                const shift = currentWeek.shifts?.find(
                  (s) => s.id === t.shiftId
                );
                const user = users.find((u) => u.id === t.userId);
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl border border-amber-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-sm">
                          {user?.name ?? t.userName ?? "Сотрудник"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Отгул на {String(t.date).slice(0, 10)}
                          {shift && ` · ${shift.startTime}–${shift.endTime}`}
                          {t.comment && ` · ${t.comment}`}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApproveTimeOff(t.id)}
                          className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 text-xs font-medium"
                        >
                          <Check className="w-3.5 h-3.5" /> Одобрить
                        </button>
                        <button
                          onClick={() => handleRejectTimeOff(t.id)}
                          className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-medium"
                        >
                          <X className="w-3.5 h-3.5" /> Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Модалка редактирования смены */}
      {editingShift && (
        <ShiftEditModal
          shift={editingShift}
          weekId={currentWeek.id}
          allShifts={currentWeek.shifts ?? []}
          users={users}
          templates={templates}
          vacations={vacations}
          sickLeaves={sickLeaves}
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

// ─── Модалка редактирования смены ─────────────────────
function ShiftEditModal({
  shift,
  users,
  templates,
  vacations,
  sickLeaves,
  onClose,
  onUpdate,
  onDelete,
  onRequestCreated,
}: any) {
  const [templateId, setTemplateId] = useState(shift.templateId ?? "");
  const [userId, setUserId] = useState(shift.userId ?? "");
  const [startTime, setStartTime] = useState(shift.startTime);
  const [endTime, setEndTime] = useState(shift.endTime);
  const [shiftDate, setShiftDate] = useState(String(shift.shiftDate).slice(0, 10));
  const [busy, setBusy] = useState(false);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t: any) => t.id === id);
    if (tpl) {
      setStartTime(tpl.startTime);
      setEndTime(tpl.endTime);
    }
  };

  const getUserStatus = (uid: string, dateStr: string) => {
    const isSick = sickLeaves.some(
      (s: any) =>
        s.userId === uid && s.startDate <= dateStr && s.endDate >= dateStr
    );
    if (isSick) return "Больничный";
    const isVacation = vacations.some(
      (v: any) =>
        v.userId === uid && v.startDate <= dateStr && v.endDate >= dateStr
    );
    if (isVacation) return "Отпуск";
    return "Свободен";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok)
      return alertDialog(timeCheck.message ?? "Неверное время", {
        title: "Ошибка",
        variant: "error",
      });

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
        await alertDialog("Отправлено на согласование", {
          title: "Успех",
          variant: "success",
        });
      } else {
        await alertDialog("Смена обновлена", {
          title: "Успех",
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
              {templates.map((t: any) => (
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
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Не назначен</option>
              {users.map((u: any) => {
                const status = getUserStatus(u.id, shiftDate);
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.position || "—"}) — {status}
                  </option>
                );
              })}
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
              {busy ? "..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(shift.id)}
              className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Удалить
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