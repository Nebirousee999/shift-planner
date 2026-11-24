import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Copy, CheckCircle2, Plus, X, Trash2, Clock, CalendarDays, AlertCircle, Pencil, Check, ClipboardPaste, CopyPlus, GripVertical, Maximize2, Minimize2, Bell, Wallet, CalendarX2, Stethoscope, Info, Undo2, Loader2 } from "lucide-react";
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
import { api } from "../api/client";
import { shiftChangeRequestsApi, type ShiftChangeRequest,  } from "../api/shiftChangeRequests";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import TeamSummary from "../components/TeamSummary";
import { weekDates, dayLabel, shortDate, fullDate } from "../lib/dates";
import { validateShiftTimes } from "../lib/time";
import { trackEvent } from "../lib/metrika";

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

if (typeof window !== "undefined") {
  const navEntries = performance.getEntriesByType("navigation");
  if (navEntries.length > 0 && navEntries[0].type === "reload") {
    localStorage.removeItem("guest_shifts");
  }
}

export default function WeekDetailPage() {
  // SUPERFIX-2: панель email вправо + редирект на /weeks после входа
    
  // Мок-данные для отображения интерфейса в гостевом режиме
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // ─── ТЕНЕВОЙ РЕЖИМ (Гость без токена) ───
  const isGuestMode = localStorage.getItem("isGuest") === "true";
  const [guestDeletedShifts, setGuestDeletedShifts] = useState<string[]>([]);
  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestEmailInput, setShowGuestEmailInput] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [emailMode, setEmailMode] = useState<"input" | "taken" | "login">("input");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [sentNote, setSentNote] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ─── Логика "занятого" email (как в WalletPage) ────────
  const handleAttachEmail = async () => {
    if (!guestEmail.includes("@")) {
      setEmailError(true);
      return;
    }
    try {
      const res: any = await api.post("/auth/update-email", { email: guestEmail });
      const body = res?.data ?? res;
      const status = res?.status ?? res?.response?.status;
      if (body?.error) {
        if (status === 409 || String(body.error).includes("занят")) {
          setEmailError(false);
          setEmailMode("login");
        } else {
          setEmailError(true);
          alert(body.error);
        }
        return;
      }
      localStorage.setItem("guestEmailAttached", "true");
      trackEvent("guest_week_attach_email");
      setShowGuestEmailInput(false);
      setEmailMode("input");
      window.dispatchEvent(new Event("guest-email-attached"));
    } catch (e: any) {
      const err = e.response?.data?.error ?? e.response?.data?.message ?? "";
      if (e.response?.status === 409 || String(err).includes("занят")) {
        setEmailError(false);
        setEmailMode("login");
        return;
      }
      setEmailError(true);
      alert(err || "Ошибка привязки почты");
    }
  };

  const handleLogin = async () => {
    try {
      const res: any = await api.post("/auth/login", {
        email: guestEmail.trim().toLowerCase(),
        password: loginPassword.trim(),
      });
      const data = res?.data ?? res;
      const tk = data?.token ?? data?.accessToken;
      if (!tk || data?.error) {
        setLoginError(true);
        return;
      }
      localStorage.setItem("guestEmailAttached", "true");
      localStorage.setItem("isGuest", "false");
      localStorage.setItem("token", tk);
      localStorage.removeItem("activeLocationId");
      // Гостевая неделя не принадлежит аккаунту — уходим в список недель,
      // иначе страница /weeks/:guestId покажет «Неделя не найдена».
      window.location.href = "/weeks";
    } catch (e: any) {
      const err = e.response?.data?.error ?? e.response?.data?.message ?? "";
      if (e.response?.status === 401 || String(err).includes("Неверный")) {
        setLoginError(true);
      } else {
        alert(err || "Ошибка входа");
      }
    }
  };

  const handleResetPassword = async () => {
    setResetting(true);
    try {
      const base = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
      const res = await fetch(`${base}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.mailSent === false) {
        alert("Не удалось отправить письмо — смотрите консоль бэкенда.");
        return;
      }
      setSentNote(true);
      setLoginPassword("");
      setLoginError(false);
    } catch (e: any) {
      console.error("❌ handleResetPassword:", e);
      alert("Ошибка отправки пароля: " + (e?.message ?? e));
    } finally {
      setResetting(false);
    }
  };

  const guestEmailPanel = (
    <div className="mt-2 p-3 bg-white border border-amber-200 rounded-xl text-left w-full max-w-md">
      {emailMode === "login" && (
        <div className="mb-3">
          <p className="text-sm text-amber-900 mb-2">
            Эта почта уже зарегистрирована. Введите другую почту ниже — или, если это ваша почта, введите пароль и войдите в свой профиль.
          </p>
          {sentNote && (
            <p className="text-sm text-emerald-700 mb-2">Пароль выслан на почту — проверьте входящие и введите его ниже.</p>
          )}
          {loginError && (
            <p className="text-sm text-rose-600 mb-2">
              Пароль введен неверно.{" "}
              <button type="button" onClick={handleResetPassword} disabled={resetting} className="underline font-semibold hover:no-underline">
                {resetting ? "Отправляем..." : "Восстановить пароль"}
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => { setLoginPassword(e.target.value); setLoginError(false); }}
              placeholder="Пароль"
              className={`py-1.5 px-3 text-sm w-full max-w-xs rounded-lg bg-white border ${loginError ? "border-red-500 ring-2 ring-red-500/20" : "border-amber-300"}`}
            />
            <button onClick={handleLogin} className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
              Войти
            </button>
          </div>
        </div>
      )}
      <p className="text-sm text-amber-900 mb-2">
        {emailMode === "input" ? "Введите вашу почту, чтобы сохранить данные:" : "Или укажите другую почту:"}
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => { setGuestEmail(e.target.value); setEmailError(false); }}
          placeholder="your@email.ru"
          className={`py-1.5 px-3 text-sm w-full max-w-xs rounded-lg bg-white border ${emailError ? "border-red-500 ring-2 ring-red-500/20" : "border-amber-300"}`}
        />
        <button onClick={handleAttachEmail} className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
          Привязать
        </button>
      </div>
    </div>
  );

  // ────────────────────────────────────────
  
  
  
  // ─── ТЕНЕВОЙ РЕЖИМ (Гость без токена) ───
  
  
  // ────────────────────────────────────────
  
  
  
  
  const {
    currentWeek,
    loading,
    error,
    fetchWeek,
    publishWeek,
    unpublishWeek,
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
  const [reverting, setReverting] = useState(false);
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
  const [manageTplOpen, setManageTplOpen] = useState(false);
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
    if (isGuestMode && localStorage.getItem("guestEmailAttached") !== "true") {
      localStorage.removeItem("guest_shifts");
    }
  }, []);

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

  
  
  
  
  

  const [guestShifts, setGuestShifts] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem("guest_shifts") || "[]");
  });
  const activeWeek = currentWeek;
  const activeUsers = users;

  if (loading && !activeWeek)
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-slate-500 text-sm">Загрузка...</p>
        </main>
      </div>
    );
  if (error || !activeWeek)
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-red-500 text-sm mb-4">{error ?? "Неделя не найдена или произошла ошибка"} </p>
          <button
            onClick={() => navigate("/weeks")}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Вернуться к неделям
          </button>
        </main>
      </div>
    );

  const isDraft = activeWeek.status === "DRAFT";
  const isLocked = activeWeek.status === "LOCKED";
  const canEdit = editMode && !isLocked;
  const dates = weekDates(activeWeek.weekStartDate);
  const weekStart = shortDate(dates[0]);
  const weekEnd = shortDate(dates[6]);
  const allShifts = isGuestMode ? [...(activeWeek.shifts ?? []).filter(s => !guestDeletedShifts.includes(s.id)), ...guestShifts] : (activeWeek.shifts ?? []);
  const shiftsByDate: Record<string, typeof activeWeek.shifts> = {};

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
  for (const s of allShifts) {
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
    if (r.status === "PENDING" && r.kind === "CREATE" && r.weekId === activeWeek.id) {
      const d = String(r.newShiftDate).slice(0, 10);
      if (!virtualCreateOutgoingByDate[d]) virtualCreateOutgoingByDate[d] = [];
      virtualCreateOutgoingByDate[d].push(r);
    }
  }

  const userStats = summaryUsers.map((u) => {
    const uShiftsWeek = allShifts.filter((s) => s.userId === u.id) || [];
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
  const totalWeekShifts = allShifts.length;

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
    // ГОСТЬ: ДОБАВЛЕНИЕ СМЕНЫ
    if (isGuestMode) {
      const newShift = {
        id: Math.random().toString(),
        shiftDate: date,
        startTime: snapshot ? snapshot.startTime : form.startTime,
        endTime: snapshot ? snapshot.endTime : form.endTime,
        userId: snapshot ? snapshot.userId : form.userId,
        templateId: snapshot ? snapshot.templateId : form.templateId,
      };
      const shifts = [...guestShifts, newShift];
      
      localStorage.setItem("guest_shifts", JSON.stringify(shifts));
      setGuestShifts(shifts); // Обновляем стейт (без перезагрузки страницы!)
      
      if (!snapshot) {
        setShowAddFor(null);
        setForm({ templateId: "", userId: "", startTime: "09:00", endTime: "18:00" });
      }
      return;
    }
  
  
    
    
    // Ограничение для теневых аккаунтов
    
    // Ограничение для теневых аккаунтов (20 смен)
    
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
          const userName = activeUsers.find((u) => u.id === userId)?.name ?? "Сотрудник";
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
          weekId: activeWeek.id,
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

      // 🔥 Проверка пересечений смен в один день
      try {
        const overlapCheck = await shiftsApi.checkOverlap({
          userId,
          weekId: activeWeek.id,
          shiftDate: date,
          startTime,
          endTime,
        });
        if (overlapCheck.overlaps) {
          const ok = await confirmDialog(
            `У сотрудника ${overlapCheck.userName} уже есть смена в это время (${overlapCheck.conflicting.map((c) => `${c.startTime}–${c.endTime}`).join(", ")}).\n\nВсё равно добавить?`,
            { title: "Пересечение смен", confirmLabel: "Добавить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const result = await addShift({
        weekId: activeWeek.id,
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
    if (isGuestMode) {
      setGuestDeletedShifts([...guestDeletedShifts, shiftId]);
      setGuestShifts(guestShifts.filter(s => s.id !== shiftId));
      if (editingShift?.id === shiftId) setEditingShift(null);
      return;
    }
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
    // ГОСТЬ: ПУБЛИКАЦИЯ
    if (isGuestMode) {
      if (localStorage.getItem("guestEmailAttached") === "true") {
        // Почта уже привязана (пользователь обновлен в БД через update-email).
        // Просто очищаем гостевой режим и переходим в полноценный ЛК.
        localStorage.removeItem("isGuest");
        localStorage.removeItem("guest_shifts");
        localStorage.removeItem("guestEmailAttached");
        window.location.href = "/";
        return;
      }

      if (localStorage.getItem("guestEmailAttached") !== "true") {
        setShowGuestEmailInput(true);
        setEmailError(true);
        await alertDialog("Введите почту вверху страницы, чтобы сохранить ваш график.", { title: "Нужен Email", variant: "error" });
        return;
      }
      return;
    }
  
    

    // 2. Если это реальный пользователь — публикуем как обычно
    setPublishing(true);
    try {
      const result = await publishWeek(activeWeek.id);
      if (!result.ok) {
        await alertDialog("Нарушения ТК РФ:\n\n" + (result.violations ?? []).join("\n"), { title: "Нельзя опубликовать", variant: "error" });
      } else {
        await alertDialog("Неделя опубликована!", { title: "Готово", variant: "success" });
        setEditMode(false);
      }
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка публикации", { title: "Ошибка", variant: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const onRevertToDraft = async () => {
    const ok = await confirmDialog(
      "Вернуть неделю в статус «Черновик»?\n\nСотрудники больше не будут видеть этот график, пока вы снова его не опубликуете. Все изменения будут применяться сразу, без согласования.",
      { title: "Вернуть в черновик", confirmLabel: "Вернуть", variant: "danger" }
    );
    if (!ok) return;

    setReverting(true);
    try {
      await unpublishWeek(activeWeek.id);
      await alertDialog("Неделя возвращена в черновик", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка возврата", { variant: "error" });
    } finally {
      setReverting(false);
    }
  };

  const onDuplicate = async () => {
    setDuplicating(true);
    try {
      const newWeek = await duplicateWeek(activeWeek.id);
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
    const shift = allShifts.find((s) => s.id === draggingShiftId);
    setDraggingShiftId(null);
    if (!shift) return;
    if (String(shift.shiftDate).slice(0, 10) === newDate) return;

    if (isGuestMode) {
      setGuestDeletedShifts([...guestDeletedShifts, shift.id]);
      setGuestShifts([...guestShifts, { ...shift, id: Math.random().toString(), shiftDate: newDate }]);
      return;
    }

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

  const onCancelShiftChange = async (requestId: string) => {
    const ok = await confirmDialog("Отменить запрос на изменение смены? Сотрудник больше не увидит его.", {
      title: "Отмена",
      confirmLabel: "Отменить запрос",
      variant: "danger",
    });
    if (!ok) return;
    setModerating(requestId);
    try {
      await shiftChangeRequestsApi.cancel(requestId);
      await refreshShiftRequests();
      if (id) await fetchWeek(id);
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка отмены", { title: "Ошибка", variant: "error" });
    } finally {
      setModerating(null);
    }
  };

  const getUserInfo = (uid: string | null) => {
    const u = activeUsers.find((x) => x.id === uid);
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
      if (activeWeek?.id) await fetchWeek(activeWeek.id);
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

  const handleUpdateShift = async (id: string, patch: any) => {
    if (isGuestMode) {
      const shift = allShifts.find(s => s.id === id);
      if (shift) {
        setGuestDeletedShifts([...guestDeletedShifts, id]);
        setGuestShifts([...guestShifts, { ...shift, ...patch, id: Math.random().toString() }]);
      }
      return { kind: "applied", shift: patch };
    }
    return await updateShift(id, patch);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Зеленый баннер-подсказка */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-sm animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Pencil className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-sm flex-1">
            <div className="font-semibold text-emerald-900 mb-1">
              Как редактировать смены
            </div>
            <div className="text-emerald-700 leading-relaxed space-y-1.5">
              <p>
                Жми <b>«Редактировать»</b>, чтобы добавить или изменить смены. Смены можно перетаскивать между днями, копировать по одной или копировать целым днём.
              </p>
              <p>
                Когда создашь смены на всю неделю, жми <b>«Опубликовать»</b>, чтобы сотрудники увидели своё расписание у себя в профиле. В профиль сотрудники могут зайти по своей почте и паролю.
              </p>
            </div>
          </div>
        </div>

        {/* Шапка */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <button
            onClick={() => navigate("/weeks")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> К списку недель
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
        {isGuestMode && localStorage.getItem("guestEmailAttached") !== "true" && showGuestEmailInput && (
          <div className="w-full flex justify-end">{guestEmailPanel}</div>
        )}
        {!isLocked && (
          <button
            onClick={async () => {
              if (editMode) {
                if (isGuestMode && localStorage.getItem("guestEmailAttached") !== "true") {
                  if (showGuestEmailInput) {
                    setEmailError(true);
                  } else {
                    setShowGuestEmailInput(true);
                  }
                  return;
                }
                setEditMode(false);
                setShowAddFor(null);
                setClipboardDay([]);
                setClipboardShift(null);
              } else {
                setEditMode(true);
              }
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
              editMode ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editMode ? (<><Check className="w-4 h-4" /> Готово</>) : (<><Pencil className="w-4 h-4" /> Редактировать</>)}
          </button>
        )}

        {isDraft && (
          <>
            <button
              onClick={onPublish}
              disabled={editMode}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                editMode
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
              }`}
              title={editMode ? "Нельзя опубликовать во время редактирования" : "Опубликовать неделю"}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {publishing ? "..." : "Опубликовать"}
            </button>
          </>
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
              Неделя с {fullDate(activeWeek.weekStartDate)}
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
          <TeamSummary users={summaryUsers}
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
              const u = activeUsers.find((x) => x.id === s.userId);
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
                          <Copy className="w-3.5 h-3.5" />
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
                              <CopyPlus className="w-3.5 h-3.5" />
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
                    const userColor = activeUsers.find((u) => u.id === s.userId)?.color;
                    const color = userColor || tpl?.color || "#3B82F6";
                    const tplColor = tpl?.color || "#3B82F6";
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
                        title={hasPending ? `${uInfo.name} у себя в профиле должен согласовать изменение смены` : undefined}
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
                            : color + "18",
                        }}
                      >
                        <div className="flex items-center gap-1 font-medium text-slate-900 flex-wrap pr-6">
                          {canEdit && !hasPending && !activeTimeOff && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <div
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm"
                            style={{
                              backgroundColor: hasPending || activeTimeOff ? "#fef3c7" : tplColor + "25",
                              borderColor: hasPending || activeTimeOff ? "#f59e0b" : tplColor + "60",
                              color: hasPending || activeTimeOff ? "#B45309" : tplColor,
                            }}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
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
                        </div>
                        <div className="flex flex-col mt-0.5">
                            <span className="text-slate-900 font-medium truncate">
                              {uInfo.name}
                            </span>
                            <span className="text-slate-500 text-[10px] truncate">
                              {uInfo.position || "—"}
                            </span>
                          </div>

                        {/* Красивая всплывающая подсказка при наведении */}
                        {hasPending && (
                          <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none text-center leading-snug">
                            <div className="font-bold text-sm mb-1 text-white">
                      {pending?.kind === "CREATE" ? "Новая смена" : "Изменение смены"}
                    </div>
                    <div className="text-slate-300 text-xs">
                      {uInfo.name} должен согласовать изменение смены в своём профиле
                    </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800" />
                          </div>
                        )}
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
                            title={`${getUserInfo(r.newUserId).name} у себя в профиле должен согласовать изменение смены`}
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
                      
                      {/* Красивая всплывающая подсказка */}
                      <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none text-center leading-snug">
                        <div className="font-bold text-sm mb-1 text-white">
                      {r.kind === "CREATE" ? "Новая смена" : "Изменение смены"}
                    </div>
                    <div className="text-slate-300 text-xs">
                      {getUserInfo(r.newUserId).name} должен согласовать изменение смены в своём профиле
                    </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800" />
                      </div>


                      {/* Красивая всплывающая подсказка */}
                      <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none text-center leading-snug">
                        <div className="font-bold text-sm mb-1 text-white">
                          {r.kind === "CREATE" ? "Новая смена" : "Изменение смены"}
                        </div>
                        <div className="text-slate-300 text-xs">
                          {getUserInfo(r.newUserId).name} должен согласовать изменение смены в своём профиле
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800" />
                      </div>

<button
                        onClick={(e) => { e.stopPropagation(); onCancelShiftChange(r.id); }}
                        disabled={moderating === r.id}
                        className="mt-1 w-full bg-white border border-rose-200 text-rose-600 text-[10px] py-1 rounded hover:bg-rose-50 font-medium transition-colors disabled:opacity-50"
                      >
                        Отменить
                      </button>
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
                    <div className="bg-blue-50 text-blue-800 p-2 rounded-lg mb-2 flex items-start gap-1.5 border border-blue-100">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="leading-tight text-[10px]">При добавлении смены в опубликованную неделю, сотруднику придёт запрос на согласование.</span>
                    </div>
                    <div className="flex gap-1 items-stretch">
                      <select
                        value={form.templateId}
                        onChange={(e) => onTemplateChange(e.target.value)}
                        className="!text-xs !py-1.5 flex-1 min-w-0"
                      >
                        <option value="">Без шаблона</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setManageTplOpen(true); }}
                        className="px-2 bg-brand-50 text-brand-600 rounded border border-brand-200 hover:bg-brand-100 flex items-center justify-center shrink-0 transition-colors"
                        title="Управлять шаблонами смен"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <select
                      value={form.userId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, userId: e.target.value }))
                      }
                      className="!text-xs !py-1.5"
                    >
                      <option value="">Не назначен</option>
                      {activeUsers.map((u) => {
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

                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startTime: e.target.value }))
                        }
                        className="!text-[11px] !px-0.5 !py-1 !w-full min-w-0 text-center"
                      />
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, endTime: e.target.value }))
                        }
                        className="!text-[11px] !px-0.5 !py-1 !w-full min-w-0 text-center"
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
                const shift = activeWeek.shifts?.find(
                  (s) => s.id === t.shiftId
                );
                const user = activeUsers.find((u) => u.id === t.userId);
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
      {manageTplOpen && (
        <ManageShiftTemplatesModal onClose={() => setManageTplOpen(false)} />
      )}

      {editingShift && (
        <ShiftEditModal shift={editingShift} weekId={activeWeek.id} allShifts={activeWeek.shifts ?? []} activeUsers={activeUsers}
          templates={templates}
          vacations={vacations}
          sickLeaves={sickLeaves}
          onClose={() => setEditingShift(null)}
          onSaved={() => setEditingShift(null)}
          onUpdate={handleUpdateShift}
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
  weekId,
  activeUsers,
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
  const [manageTplOpen, setManageTplOpen] = useState(false);

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
    if (localStorage.getItem("isGuest") === "true") {
      alertDialog("В гостевом режиме нельзя редактировать смены.", { variant: "error" });
      return;
    }
    const timeCheck = validateShiftTimes(startTime, endTime);
    if (!timeCheck.ok)
      return alertDialog(timeCheck.message ?? "Неверное время", {
        title: "Ошибка",
        variant: "error",
      });

    // 🔥 Проверка пересечений при редактировании
    if (userId) {
      try {
        const overlapCheck = await shiftsApi.checkOverlap({
          userId,
          weekId,
          shiftDate,
          startTime,
          endTime,
          excludeShiftId: shift.id, // Исключаем саму редактируемую смену
        });
        if (overlapCheck.overlaps) {
          const ok = await confirmDialog(
            `У сотрудника ${overlapCheck.userName} уже есть смена в это время (${overlapCheck.conflicting.map((c: any) => `${c.startTime}–${c.endTime}`).join(", ")}).\n\nВсё равно сохранить?`,
            { title: "Пересечение смен", confirmLabel: "Сохранить", variant: "danger" }
          );
          if (!ok) return;
        }
      } catch {
        /* ignore */
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Шаблон
              </label>
              <button
                type="button"
                onClick={() => setManageTplOpen(true)}
                className="text-brand-600 hover:bg-brand-50 p-1 rounded transition-colors"
                title="Управлять шаблонами смен"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
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
              {activeUsers.map((u: any) => {
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
      {manageTplOpen && (
        <ManageShiftTemplatesModal onClose={() => setManageTplOpen(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МОДАЛКА УПРАВЛЕНИЯ ШАБЛОНАМИ СМЕН
// ═══════════════════════════════════════════════════════
function ManageShiftTemplatesModal({ onClose }: { onClose: () => void }) {
  const { items, create, update, remove } = useShiftTemplates();
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("18:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await create({ name: newName.trim(), startTime: newStart, endTime: newEnd });
      setNewName("");
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить "${name}"?`)) return;
    try { await remove(id); } catch (err: any) { alert(err.response?.data?.error ?? "Ошибка"); }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditStart(item.startTime);
    setEditEnd(item.endTime);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await update(editingId, { name: editName.trim(), startTime: editStart, endTime: editEnd });
      setEditingId(null);
    } catch (err: any) { alert(err.response?.data?.error ?? "Ошибка"); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg">Управление шаблонами смен</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название (напр. Утренняя)" className="!text-sm !py-1.5" required />
          <div className="flex gap-2">
            <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="!text-sm !py-1.5 flex-1" required />
            <span className="flex items-center text-slate-400">—</span>
            <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="!text-sm !py-1.5 flex-1" required />
          </div>
          <button type="submit" disabled={busy || !newName.trim()} className="mt-1 bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Список пуст</p>}
          {items.map(item => (
            <div key={item.id} className="flex flex-col p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
              {editingId === item.id ? (
                <div className="flex flex-col gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="!text-sm !py-1" autoFocus />
                  <div className="flex gap-2">
                    <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="!text-sm !py-1 flex-1" />
                    <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="!text-sm !py-1 flex-1" />
                  </div>
                  <div className="flex justify-end gap-1 mt-1">
                    <button onClick={saveEdit} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded text-xs font-medium">Сохранить</button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 p-1 hover:bg-slate-100 rounded text-xs">Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.startTime} – {item.endTime}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => startEdit(item)} className="text-slate-400 hover:text-brand-600 p-1.5 rounded hover:bg-brand-50">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(item.id, item.name)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
