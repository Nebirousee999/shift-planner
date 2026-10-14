import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Activity,
  CalendarDays,
  Clock,
  ArrowRightLeft,
  Check,
  X,
  User as UserIcon,
  Inbox,
  Send,
  XCircle,
  Palmtree,
  Plus,
  AlertCircle,
} from "lucide-react";
import { meApi, type MyShift, type Colleague } from "../api/me";
import { useTimeEntries } from "../store/timeEntries";
import { useSwaps } from "../store/swaps";
import { useVacations } from "../store/vacations";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import { alertDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import { weekDates, dayLabel, shortDate } from "../lib/dates";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hh}:${mm}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);

  const { active, fetchActive, clockIn, clockOut } = useTimeEntries();
  const {
    incoming,
    outgoing,
    create: createSwap,
    accept,
    decline,
    cancel,
    fetchMine,
  } = useSwaps();
  const {
    mine: myVacations,
    fetchMine: fetchVacations,
    create: createVacation,
    remove: removeVacation,
  } = useVacations();

  const [busy, setBusy] = useState(false);
  const [swapShift, setSwapShift] = useState<MyShift | null>(null);
  const [swapTarget, setSwapTarget] = useState<string>("");
  const [swapBusy, setSwapBusy] = useState(false);

  // Форма отпуска
  const [showVacForm, setShowVacForm] = useState(false);
  const [vacForm, setVacForm] = useState({
    startDate: "",
    endDate: "",
    comment: "",
  });
  const [vacBusy, setVacBusy] = useState(false);

  const loadAll = async () => {
    try {
      const [s, cols] = await Promise.all([
        meApi.myShifts(),
        meApi.colleagues(),
        fetchActive(),
        fetchMine(),
        fetchVacations(),
      ]);
      setShifts(s);
      setColleagues(cols);
    } catch {
      await alertDialog("Ошибка загрузки", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClockIn = async () => {
    setBusy(true);
    try {
      await clockIn();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const onClockOut = async () => {
    setBusy(true);
    try {
      await clockOut();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openSwapModal = (shift: MyShift) => {
    setSwapShift(shift);
    setSwapTarget("");
  };

  const closeSwapModal = () => {
    setSwapShift(null);
    setSwapTarget("");
  };

  const onConfirmSwap = async () => {
    if (!swapShift) return;
    setSwapBusy(true);
    try {
      await createSwap({
        shiftId: swapShift.id,
        swapWithUserId: swapTarget || undefined,
      });

      // Обновляем счётчики уведомлений
      useNotifications.getState().refresh();

      closeSwapModal();
      await alertDialog("Запрос на обмен отправлен", {
        title: "Готово",
        variant: "success",
      });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setSwapBusy(false);
    }
  };

  const onAccept = async (id: string) => {
    try {
      await accept(id);
      useNotifications.getState().refresh();
      await loadAll();
      await alertDialog("Обмен принят — смена перешла к вам", {
        title: "Готово",
        variant: "success",
      });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  const onDecline = async (id: string) => {
    try {
      await decline(id);
      useNotifications.getState().refresh();
      await loadAll();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  const onCancelSwap = async (id: string) => {
    try {
      await cancel(id);
      useNotifications.getState().refresh();
      await loadAll();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  // ─── Отпуска ────────────────────────────────────────
  const onAddVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacForm.startDate || !vacForm.endDate) {
      await alertDialog("Заполните даты", { variant: "error" });
      return;
    }
    if (vacForm.startDate > vacForm.endDate) {
      await alertDialog("Дата начала позже окончания", { variant: "error" });
      return;
    }
    setVacBusy(true);
    try {
      await createVacation({
        startDate: vacForm.startDate,
        endDate: vacForm.endDate,
        comment: vacForm.comment || undefined,
      });

      // Обновляем счётчики уведомлений
      useNotifications.getState().refresh();

      setVacForm({ startDate: "", endDate: "", comment: "" });
      setShowVacForm(false);
      await alertDialog(
        "Отпуск отправлен на согласование руководителю",
        { title: "Готово", variant: "success" }
      );
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setVacBusy(false);
    }
  };

  const onDeleteVacation = async (id: string) => {
    try {
      await removeVacation(id);
      useNotifications.getState().refresh();
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  // Группируем смены по неделям
  const groups = new Map<string, MyShift[]>();
  for (const s of shifts) {
    const dateStr = String(s.shiftDate).slice(0, 10);
    const d = new Date(dateStr + "T00:00:00Z");
    const dow = d.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + diff);
    const weekStart = d.toISOString().slice(0, 10);
    if (!groups.has(weekStart)) groups.set(weekStart, []);
    groups.get(weekStart)!.push(s);
  }
  const sortedWeeks = Array.from(groups.keys()).sort();

  const otherColleagues = colleagues.filter((c) => c.id !== user?.id);
  const incomingActive = incoming.filter((r) => r.status === "PENDING");
  const outgoingActive = outgoing.filter((r) => r.status === "PENDING");

  const today = new Date().toISOString().slice(0, 10);
  const upcomingVacations = myVacations.filter((v) => v.endDate >= today);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Мой график</h1>
            <p className="text-sm text-slate-500 mt-1">
              Ваши смены, отпуска, обмены и учёт рабочего времени
            </p>
          </div>

          <div>
            {!active ? (
              <button
                onClick={onClockIn}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                <Play className="w-4 h-4" />
                {busy ? "..." : "Начать смену"}
              </button>
            ) : (
              <button
                onClick={onClockOut}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                <Square className="w-4 h-4" />
                {busy ? "..." : "Закончить смену"}
              </button>
            )}
          </div>
        </div>

        {/* Активная смена */}
        {active && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-emerald-900">
                Смена открыта
              </div>
              <div className="text-sm text-emerald-700 mt-0.5">
                Начало: {formatDateTime(active.clockIn)} · Прошло{" "}
                {elapsedSince(active.clockIn!)}
              </div>
            </div>
          </div>
        )}

        {/* Входящие предложения обмена */}
        {incomingActive.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-amber-600" />
              Входящие предложения
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium ring-1 ring-amber-200">
                {incomingActive.length}
              </span>
            </h3>
            <div className="space-y-2">
              {incomingActive.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50/40 pl-3 pr-2 py-3 rounded-r-lg flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-sm">
                      Предложение обмена сменой
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.shiftDate
                        ? `${String(r.shiftDate).slice(0, 10)} · ${
                            r.startTime
                          }–${r.endTime}`
                        : "—"}
                      {r.requestedByName && ` · от ${r.requestedByName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAccept(r.id)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Принять
                    </button>
                    <button
                      onClick={() => onDecline(r.id)}
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Мои исходящие */}
        {outgoingActive.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-400" />
              Мои предложения
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {outgoingActive.length}
              </span>
            </h3>
            <div className="space-y-2">
              {outgoingActive.map((r) => {
                const target = r.swapWithUserId
                  ? colleagues.find((c) => c.id === r.swapWithUserId)?.name ??
                    "—"
                  : "Открытая (любой)";
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border-l-4 border-slate-300 bg-slate-50 pl-3 pr-2 py-2.5 rounded-r-lg flex-wrap"
                  >
                    <div className="text-sm min-w-0">
                      <div className="text-slate-700">
                        Ожидает ответа:{" "}
                        <span className="font-medium">{target}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onCancelSwap(r.id)}
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Отменить
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Мои отпуска */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-emerald-600" />
              Мои отпуска
              {upcomingVacations.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium ring-1 ring-emerald-200">
                  {upcomingVacations.length} предстоящих
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowVacForm((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {showVacForm ? "Отмена" : "Добавить отпуск"}
            </button>
          </div>

          {showVacForm && (
            <form
              onSubmit={onAddVacation}
              className="bg-slate-50 rounded-xl p-4 mb-3 space-y-3 animate-fade-in"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Дата начала
                  </label>
                  <input
                    type="date"
                    value={vacForm.startDate}
                    onChange={(e) =>
                      setVacForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Дата окончания
                  </label>
                  <input
                    type="date"
                    value={vacForm.endDate}
                    onChange={(e) =>
                      setVacForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Комментарий
                </label>
                <input
                  value={vacForm.comment}
                  onChange={(e) =>
                    setVacForm((f) => ({ ...f, comment: e.target.value }))
                  }
                  placeholder="Ежегодный оплачиваемый"
                  maxLength={255}
                />
              </div>
              <button
                type="submit"
                disabled={vacBusy}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {vacBusy ? "Сохранение..." : "Сохранить"}
              </button>
            </form>
          )}

          {myVacations.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              У вас пока нет отпусков. Добавьте дату — руководитель увидит её
              при составлении графика.
            </p>
          ) : (
            <div className="space-y-2">
              {myVacations.map((v) => {
                const isPast = v.endDate < today;
                const isPending = v.status === "PENDING";

                let borderColor = "border-emerald-500";
                let bgColor = "bg-emerald-50/40";
                if (isPast) {
                  borderColor = "border-slate-300";
                  bgColor = "bg-slate-50 opacity-70";
                } else if (isPending) {
                  borderColor = "border-amber-500";
                  bgColor = "bg-amber-50/40";
                }

                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-3 border-l-4 pl-3 py-2 rounded-r-lg ${borderColor} ${bgColor}`}
                  >
                    <div className="text-sm min-w-0">
                      <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                        {formatShortDate(v.startDate)} —{" "}
                        {formatShortDate(v.endDate)}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            На согласовании
                          </span>
                        )}
                      </div>
                      {v.comment && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {v.comment}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteVacation(v.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}

        {/* Смены */}
        {!loading && shifts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              У вас пока нет смен
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Когда руководитель назначит вам смены и опубликует график, они
              появятся здесь
            </p>
          </div>
        )}

        {sortedWeeks.map((weekStart) => {
          const weekShifts = groups.get(weekStart)!;
          const weekStatus = weekShifts[0]?.weekStatus;
          const dates = weekDates(weekStart);
          const totalHours = weekShifts.reduce((sum, s) => {
            const [sh, sm] = s.startTime.split(":").map(Number);
            const [eh, em] = s.endTime.split(":").map(Number);
            let m = eh * 60 + em - (sh * 60 + sm);
            if (m <= 0) m += 24 * 60;
            return sum + m / 60;
          }, 0);

          return (
            <div key={weekStart} className="mb-8">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900">
                  Неделя {shortDate(dates[0])} — {shortDate(dates[6])}
                </h2>
                {weekStatus === "DRAFT" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 font-medium">
                    черновик
                  </span>
                )}
                {weekStatus === "PUBLISHED" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-medium">
                    опубликован
                  </span>
                )}
                <span className="text-xs text-slate-500 ml-auto">
                  {weekShifts.length} смен ·{" "}
                  {Math.round(totalHours * 10) / 10} ч
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {dates.map((date) => {
                  const dayShifts = weekShifts.filter(
                    (s) => String(s.shiftDate).slice(0, 10) === date
                  );
                  const isToday =
                    date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={date}
                      className={`bg-white rounded-2xl border shadow-sm p-3 min-h-[120px] flex flex-col transition-all ${
                        isToday
                          ? "border-brand-300 ring-2 ring-brand-500/10"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div
                            className={`font-semibold text-sm ${
                              isToday ? "text-brand-700" : "text-slate-900"
                            }`}
                          >
                            {dayLabel(date)}
                          </div>
                          {isToday && (
                            <span className="text-[10px] uppercase tracking-wide text-brand-600 font-semibold">
                              сегодня
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {shortDate(date)}
                        </div>
                      </div>

                      <div className="space-y-2 flex-1">
                        {dayShifts.length === 0 && (
                          <div className="text-xs text-slate-300 text-center py-3">
                            —
                          </div>
                        )}
                        {dayShifts.map((s) => {
                          const hasOutgoing = outgoingActive.some(
                            (r) => r.shiftId === s.id
                          );
                          const isSwappable =
                            weekStatus === "PUBLISHED" && !hasOutgoing;
                          return (
                            <div
                              key={s.id}
                              className="text-xs p-2 rounded-lg border-l-4 bg-blue-50/40 border-blue-500"
                            >
                              <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                {s.startTime}–{s.endTime}
                              </div>
                              {s.templateName && (
                                <div className="text-slate-500 truncate mt-0.5">
                                  {s.templateName}
                                </div>
                              )}
                              {isSwappable && (
                                <button
                                  onClick={() => openSwapModal(s)}
                                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-700"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  Обмен
                                </button>
                              )}
                              {hasOutgoing && (
                                <div className="mt-1.5 text-[10px] font-medium text-amber-600">
                                  запрос отправлен
                                </div>
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
          );
        })}
      </main>

      {/* Модалка выбора коллеги */}
      {swapShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={closeSwapModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">
                  Предложить обмен
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {String(swapShift.shiftDate).slice(0, 10)} ·{" "}
                  {swapShift.startTime}–{swapShift.endTime}
                </p>
              </div>
              <button
                onClick={closeSwapModal}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer hover:bg-slate-50 ${
                  swapTarget === ""
                    ? "border-brand-500 bg-brand-50/30"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="swap-target"
                  value=""
                  checked={swapTarget === ""}
                  onChange={() => setSwapTarget("")}
                  className="!w-4 !h-4 mt-1 !p-0"
                />
                <div>
                  <div className="font-medium text-slate-900 text-sm">
                    Открытая смена
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Любой сотрудник с подходящей ролью сможет взять её
                  </div>
                </div>
              </label>

              {otherColleagues.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Или конкретный сотрудник
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {otherColleagues.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${
                          swapTarget === c.id
                            ? "border-brand-500 bg-brand-50/30"
                            : "border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="swap-target"
                          value={c.id}
                          checked={swapTarget === c.id}
                          onChange={() => setSwapTarget(c.id)}
                          className="!w-4 !h-4 !p-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-semibold shrink-0">
                          {c.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-sm truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {c.email}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onConfirmSwap}
                disabled={swapBusy}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-all"
              >
                <Send className="w-4 h-4" />
                {swapBusy ? "..." : "Отправить предложение"}
              </button>
              <button
                onClick={closeSwapModal}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}