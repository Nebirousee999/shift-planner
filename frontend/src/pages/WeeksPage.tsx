import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CheckCircle2,
  FileEdit,
  Lock,
  Users,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  ClipboardPaste,
} from "lucide-react";
import { useWeeks } from "../store/weeks";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useUsers } from "../store/users";
import { useVacations } from "../store/vacations";
import { useSickLeaves } from "../store/sickLeaves";
import { useLocations } from "../store/locations";
import { shiftChangeRequestsApi } from "../api/shiftChangeRequests";
import { confirmDialog, alertDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad2(n: number): string { return String(n).padStart(2, "0"); }
function toDateStr(d: Date): string { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function getMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function buildMonthWeeks(year: number, month: number): Date[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const start = getMonday(first);
  const end = new Date(last);
  const dow = end.getUTCDay();
  const tail = dow === 0 ? 0 : 7 - dow;
  end.setUTCDate(end.getUTCDate() + tail);

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
const calcHours = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
};
const formatMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

const ProgressBar = ({ current, max }: { current: number, max: number }) => {
  const isOver = current > max;
  const percent = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
      <div className={`h-full transition-all duration-300 ${isOver ? "bg-rose-500" : "bg-blue-500"}`} style={{ width: `${percent}%` }} />
    </div>
  );
};

type StatusMeta = { label: string; icon: React.ElementType; badge: string; bar: string; };
const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: "Черновик", icon: FileEdit, badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200", bar: "bg-slate-300" },
  PUBLISHED: { label: "Опубликован", icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", bar: "bg-emerald-500" },
  LOCKED: { label: "Заблокирован", icon: Lock, badge: "bg-red-50 text-red-700 ring-1 ring-red-200", bar: "bg-red-500" },
};

function ShiftLines({ shifts, templateColorById }: { shifts: any[]; templateColorById: (id: string | null) => string; }) {
  if (shifts.length === 0) return null;
  return (
    <div className="w-full mt-1 space-y-[3px]">
      {shifts.map((s, i) => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        const endFixed = end <= start ? 24 * 60 : end;
        const leftPct = (start / (24 * 60)) * 100;
        const widthPct = ((endFixed - start) / (24 * 60)) * 100;
        const color = templateColorById(s.templateId);
        return (
          <div key={i} className="relative w-full h-[4px]">
            <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%`, backgroundColor: color }} title={`${s.startTime}–${s.endTime}`} />
          </div>
        );
      })}
    </div>
  );
}

export default function WeeksPage() {
  const navigate = useNavigate();
  const { weeks, loading, error, fetchWeeks, createWeek, removeWeek, addShift } = useWeeks();
  const { items: templates, fetch: fetchTemplates } = useShiftTemplates();
  const { items: users, fetch: fetchUsers } = useUsers();
  const { all: vacations, fetchAll: fetchVacations } = useVacations();
  const { all: sickLeaves, fetchAll: fetchSickLeaves } = useSickLeaves();
  const { activeLocationId, fetch: fetchLocations } = useLocations();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());

  const [showForm, setShowForm] = useState(false);
  const [newDate, setNewDate] = useState(today.toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(true);

  const [clipboardWeek, setClipboardWeek] = useState<{ startDate: string; shifts: any[] } | null>(null);

  const todayStr = today.toISOString().slice(0, 10);

  // Загружаем локации
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Загружаем всё остальное, когда известна активная локация
  useEffect(() => {
    if (!activeLocationId) return;
    fetchWeeks(activeLocationId);
    fetchTemplates();
    fetchUsers();
    fetchVacations();
    fetchSickLeaves();
    Promise.all([
      shiftChangeRequestsApi.incoming().catch(() => []),
      shiftChangeRequestsApi.outgoing().catch(() => []),
    ]).then(([inc, out]) => {
      const set = new Set<string>();
      for (const r of [...inc, ...out]) {
        if (r.status !== "PENDING") continue;
        set.add(String(r.oldShiftDate).slice(0, 10));
        set.add(String(r.newShiftDate).slice(0, 10));
      }
      setPendingDates(set);
    });
  }, [activeLocationId, fetchWeeks, fetchTemplates, fetchUsers, fetchVacations, fetchSickLeaves]);

  const calendarWeeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const weeksMap = useMemo(() => {
    const map = new Map<string, (typeof weeks)[number]>();
    for (const w of weeks) map.set(String(w.weekStartDate).slice(0, 10), w);
    return map;
  }, [weeks]);

  const templateColorById = (id: string | null): string => {
    if (!id) return "#94A3B8";
    return templates.find((t) => t.id === id)?.color ?? "#94A3B8";
  };

  const currentMonthStr = `${year}-${pad2(month + 1)}`;

  const monthUserStats = users.map(u => {
    const rate = u.hourlyRate ? Number(u.hourlyRate) : 0;
    let monthHours = 0;
    let monthShiftsCount = 0;

    for (const w of weeks) {
      if (!w.weekStartDate.startsWith(currentMonthStr)) continue;
      const shifts = w.shifts?.filter((s: any) => s.userId === u.id) || [];
      monthHours += shifts.reduce((acc: number, s: any) => acc + calcHours(s.startTime, s.endTime), 0);
      monthShiftsCount += shifts.length;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isVacation = vacations.some(v => v.userId === u.id && v.startDate <= todayStr && v.endDate >= todayStr);
    const isSick = sickLeaves.some(s => s.userId === u.id && s.startDate <= todayStr && s.endDate >= todayStr);
    const status = isSick ? "Больничный" : isVacation ? "Отпуск" : "Свободен";

    return { ...u, monthHours, monthShiftsCount, monthCost: monthHours * rate, status };
  });

  const totalMonthShifts = monthUserStats.reduce((acc, u) => acc + u.monthShiftsCount, 0);
  const totalMonthCost = monthUserStats.reduce((acc, u) => acc + u.monthCost, 0);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const goToday = () => { setYear(today.getUTCFullYear()); setMonth(today.getUTCMonth()); };

  const ensureLocation = async (): Promise<boolean> => {
    if (!activeLocationId) {
      await alertDialog(
        "Сначала выберите или создайте точку в разделе «Точки»",
        { title: "Нет активной точки", variant: "error" }
      );
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (!(await ensureLocation())) return;
    setCreating(true);
    try {
      const week = await createWeek({
        weekStartDate: newDate,
        locationId: activeLocationId!,
      });
      setShowForm(false);
      navigate(`/weeks/${week.id}`);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const onWeekClick = async (weekStart: Date) => {
    const key = toDateStr(weekStart);
    const existing = weeksMap.get(key);
    if (existing) {
      navigate(`/weeks/${existing.id}`);
    } else {
      if (!(await ensureLocation())) return;
      setCreating(true);
      try {
        const week = await createWeek({
          weekStartDate: key,
          locationId: activeLocationId!,
        });
        navigate(`/weeks/${week.id}`);
      } catch (e: any) {
        alertDialog(e.response?.data?.error ?? "Ошибка создания");
      } finally {
        setCreating(false);
      }
    }
  };

  const onDeleteWeek = async (e: React.MouseEvent, id: string, dateStr: string) => {
    e.stopPropagation();
    const ok = await confirmDialog(
      `Удалить неделю с ${dateStr}? Все смены будут удалены.`,
      { title: "Удаление", confirmLabel: "Удалить", variant: "danger" }
    );
    if (!ok) return;
    try {
      await removeWeek(id);
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка удаления", { variant: "error" });
    }
  };

  const onCopyWeek = (e: React.MouseEvent, week: any) => {
    e.stopPropagation();
    if (!week || !week.shifts || week.shifts.length === 0) return;
    setClipboardWeek({
      startDate: String(week.weekStartDate).slice(0, 10),
      shifts: week.shifts.map((s: any) => ({ ...s })),
    });
  };

  const onPasteWeek = async (e: React.MouseEvent, targetStartDate: Date) => {
    e.stopPropagation();
    if (!clipboardWeek) return;
    if (!(await ensureLocation())) return;

    const targetStr = toDateStr(targetStartDate);
    let targetWeek = weeksMap.get(targetStr);

    try {
      if (!targetWeek) {
        targetWeek = await createWeek({
          weekStartDate: targetStr,
          locationId: activeLocationId!,
        });
      }

      const origStart = new Date(clipboardWeek.startDate + "T00:00:00Z");
      const newStart = new Date(targetStr + "T00:00:00Z");
      const diffDays = Math.round((newStart.getTime() - origStart.getTime()) / (1000 * 60 * 60 * 24));

      let successCount = 0;
      for (const shift of clipboardWeek.shifts) {
        const origShiftDate = new Date(String(shift.shiftDate).slice(0, 10) + "T00:00:00Z");
        origShiftDate.setUTCDate(origShiftDate.getUTCDate() + diffDays);
        const newShiftDate = origShiftDate.toISOString().slice(0, 10);

        await addShift({
          weekId: targetWeek.id,
          templateId: shift.templateId,
          userId: shift.userId,
          shiftDate: newShiftDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
        });
        successCount++;
      }

      if (activeLocationId) await fetchWeeks(activeLocationId);
      await alertDialog(
        `Успешно вставлено ${successCount} смен(ы).\n\n${
          targetWeek.status === "PUBLISHED"
            ? "Так как неделя опубликована, изменения ушли на согласование сотрудникам."
            : ""
        }`,
        { title: "Готово", variant: "success" }
      );
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка вставки", { variant: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Недели</h1>
            <p className="text-sm text-slate-500 mt-1">Нажмите на неделю — откроется график.</p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all">
            {showForm ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Новая неделя</>}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-1">Создать новую неделю</h3>
            <p className="text-sm text-slate-500 mb-4">Любая дата будет приведена к понедельнику</p>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Дата недели</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="!w-48" />
              </div>
              <button onClick={onCreate} disabled={creating} className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all">
                {creating ? "Создание..." : "Создать"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* МЕСЯЧНАЯ СВОДКА */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <button onClick={() => setShowSummary(!showSummary)} className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-800 flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /> Сводка за месяц ({MONTHS_RU[month]} {year})</span>
            </div>
            {showSummary ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showSummary && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {monthUserStats.map(u => (
                <div key={u.id} className={`px-4 py-3 rounded-xl border flex flex-col shadow-sm transition-all ${u.status === 'Больничный' ? 'bg-rose-50 border-rose-200' : u.status === 'Отпуск' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-semibold text-slate-900 text-sm truncate">{u.name}</span>
                      <span className="text-slate-500 text-[11px] truncate">{u.position || "—"}</span>
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${u.status === 'Свободен' ? 'text-emerald-600' : 'text-rose-600'}`}>{u.status}</div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-0.5">
                    <span>Месяц ({Math.round(u.monthHours)} ч • {u.monthShiftsCount} см.)</span>
                    <span className="text-slate-700">{formatMoney(u.monthCost)}</span>
                  </div>
                  <ProgressBar current={u.monthHours} max={160} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* НАВИГАЦИЯ ПО МЕСЯЦАМ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <div className="font-semibold text-slate-900 min-w-[160px] text-center">{MONTHS_RU[month]} {year}</div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={goToday} className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors">Сегодня</button>
          </div>

          <div className="flex items-center gap-4 pr-2">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Смен за месяц</span>
              <span className="text-lg font-bold text-slate-900 leading-tight">{totalMonthShifts}</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Затраты за месяц</span>
              <span className="text-lg font-bold text-emerald-600 leading-tight">{formatMoney(totalMonthCost)}</span>
            </div>
          </div>
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex bg-slate-50 border-b border-slate-200">
            <div className="flex-1 grid grid-cols-7">
              {WEEKDAYS_RU.map((d, i) => (
                <div key={d} className={`py-3 text-center text-xs font-medium uppercase tracking-wide ${i >= 5 ? "text-slate-400" : "text-slate-600"}`}>{d}</div>
              ))}
            </div>
            <div className="w-36 shrink-0 border-l border-slate-200 bg-slate-100/50" />
          </div>

          {calendarWeeks.map((week) => {
            const weekStart = week[0];
            const key = toDateStr(weekStart);
            const existing = weeksMap.get(key);
            const meta = existing ? STATUS_META[existing.status] : null;
            const StatusIcon = meta?.icon;
            const hasToday = week.some((d) => toDateStr(d) === todayStr);

            const shiftsByDate = new Map<string, any[]>();
            for (const s of existing?.shifts ?? []) {
              const dateKey = String(s.shiftDate).slice(0, 10);
              if (!shiftsByDate.has(dateKey)) shiftsByDate.set(dateKey, []);
              shiftsByDate.get(dateKey)!.push(s);
            }

            const weekShifts = existing?.shifts || [];
            const weekCost = weekShifts.reduce((acc, s: any) => {
              const u = users.find(x => x.id === s.userId);
              return acc + (calcHours(s.startTime, s.endTime) * (u?.hourlyRate ? Number(u.hourlyRate) : 0));
            }, 0);

            return (
              <div key={key} onClick={() => onWeekClick(weekStart)} className={`flex w-full border-b border-slate-100 last:border-0 relative text-left transition-colors group cursor-pointer ${hasToday ? "bg-blue-50/60" : "hover:bg-slate-50/70"}`}>
                {meta && <div className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`} />}

                <div className="flex-1 grid grid-cols-7">
                  {week.map((d, i) => {
                    const dateStr = toDateStr(d);
                    const isToday = dateStr === todayStr;
                    const isWeekend = i >= 5;
                    const isOtherMonth = d.getUTCMonth() !== month;
                    const dayShifts = shiftsByDate.get(dateStr) ?? [];
                    const hasPendingRequest = pendingDates.has(dateStr);

                    const dayCost = dayShifts.reduce((acc, s) => {
                      const u = users.find(x => x.id === s.userId);
                      return acc + (calcHours(s.startTime, s.endTime) * (u?.hourlyRate ? Number(u.hourlyRate) : 0));
                    }, 0);

                    return (
                      <div key={dateStr} className={`relative pt-2 px-1.5 pb-2 flex flex-col border-r border-slate-100 last:border-0 min-h-[85px] ${isToday ? 'bg-blue-100/60' : isWeekend ? "bg-slate-50/40" : ""}`}>
                        {hasPendingRequest && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white z-10" title="Есть запрос" />}
                        <div className="flex items-center justify-center">
                          <div className={`text-base font-semibold ${isToday ? "w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm shadow-sm" : isOtherMonth ? "text-slate-300" : isWeekend ? "text-slate-400" : "text-slate-900"}`}>{d.getUTCDate()}</div>
                        </div>
                        <ShiftLines shifts={dayShifts} templateColorById={templateColorById} />

                        {dayShifts.length > 0 && (
                          <div className="mt-auto pt-1 text-center text-[10px] text-slate-600 leading-tight font-medium">
                            {dayShifts.length} см. • {new Intl.NumberFormat("ru-RU").format(dayCost)} ₽
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="w-36 shrink-0 border-l border-slate-200 bg-slate-50/80 flex flex-col justify-between items-center px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 w-full mt-1">
                    {meta && StatusIcon ? (
                      <>
                        <span className={`inline-flex items-center justify-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm ${meta.badge}`}>
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        {existing.status === "DRAFT" && (
                          <button
                            onClick={(e) => onDeleteWeek(e, existing.id, key)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-100 p-1 rounded-md transition-colors shrink-0"
                            title="Удалить черновик"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Нет графика</span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-600 flex flex-col gap-0.5 pointer-events-none mb-1">
                    {existing && weekShifts.length > 0 ? (
                      <>
                        <span><b className="text-slate-900">{weekShifts.length}</b> смен</span>
                        <span className="text-emerald-700 font-bold">{formatMoney(weekCost)}</span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-auto">
                    <button
                      onClick={(e) => onCopyWeek(e, existing)}
                      disabled={!existing || weekShifts.length === 0}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
                      title="Копировать все смены недели"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => onPasteWeek(e, weekStart)}
                      disabled={!clipboardWeek}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-md transition-colors"
                      title={`Вставить ${clipboardWeek ? clipboardWeek.shifts.length : 0} смен`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {!existing && !hasToday && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-xs text-slate-500 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">+ Создать неделю</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 px-1 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-300" /> Черновик</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /> Опубликован</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500" /> Заблокирован</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Запрос</div>
          <div className="flex items-center gap-1.5 ml-4"><div className="w-8 h-1 rounded-full bg-brand-500" /> Полоска = смена</div>
        </div>
      </main>
    </div>
  );
}