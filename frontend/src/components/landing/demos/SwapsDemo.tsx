import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  X,
  Clock,
  User,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Inbox,
  Bell,
} from "lucide-react";

// ─── Типы ──────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  position: string;
  color: string;
};

type SwapStatus = "pending" | "approved" | "declined";

type SwapRequest = {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string | null;
  shiftDate: string;
  shiftTime: string;
  templateName: string;
  status: SwapStatus;
};

type DemoShift = {
  id: string;
  employeeId: string;
  dayIndex: number; // 0 = Пн, 1 = Вт, ... 6 = Вс
  time: string;
  status: "normal" | "pending" | "swapped";
  swapRequestId?: string;
};

const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Мария Иванова", position: "продавец", color: "#3b82f6" },
  { id: "e2", name: "Иван Петров", position: "повар", color: "#8b5cf6" },
  { id: "e3", name: "Анна Сидорова", position: "официант", color: "#10b981" },
  { id: "e4", name: "Олег Кузнецов", position: "бариста", color: "#f59e0b" },
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const INITIAL_REQUESTS: SwapRequest[] = [
  {
    id: "r1",
    fromEmployeeId: "e1",
    toEmployeeId: "e3",
    shiftDate: "Пн, 20 окт",
    shiftTime: "09:00–15:00",
    templateName: "Утренняя",
    status: "pending",
  },
  {
    id: "r2",
    fromEmployeeId: "e2",
    toEmployeeId: null,
    shiftDate: "Ср, 22 окт",
    shiftTime: "12:00–20:00",
    templateName: "Дневная",
    status: "pending",
  },
  {
    id: "r3",
    fromEmployeeId: "e4",
    toEmployeeId: "e1",
    shiftDate: "Пт, 24 окт",
    shiftTime: "10:00–18:00",
    templateName: "Дневная",
    status: "pending",
  },
];

const INITIAL_SHIFTS: DemoShift[] = [
  // Смены, участвующие в обмене
  { id: "s1", employeeId: "e1", dayIndex: 0, time: "09:00–15:00", status: "pending", swapRequestId: "r1" },
  { id: "s2", employeeId: "e2", dayIndex: 2, time: "12:00–20:00", status: "pending", swapRequestId: "r2" },
  { id: "s3", employeeId: "e4", dayIndex: 4, time: "10:00–18:00", status: "pending", swapRequestId: "r3" },
  // Фоновые смены
  { id: "s4", employeeId: "e3", dayIndex: 1, time: "14:00–22:00", status: "normal" },
  { id: "s5", employeeId: "e1", dayIndex: 3, time: "10:00–18:00", status: "normal" },
  { id: "s6", employeeId: "e2", dayIndex: 5, time: "10:00–18:00", status: "normal" },
  { id: "s7", employeeId: "e4", dayIndex: 6, time: "08:00–14:00", status: "normal" },
];

// ─── Toast ─────────────────────────────────────────
type Toast = { id: number; type: "success" | "error"; text: string };
let toastCounter = 0;

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function SwapsDemo({ onInteract }: Props) {
  const [requests, setRequests] = useState<SwapRequest[]>(INITIAL_REQUESTS);
  const [shifts, setShifts] = useState<DemoShift[]>(INITIAL_SHIFTS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const interact = () => onInteract?.();

  const pending = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests]
  );
  const history = useMemo(
    () => requests.filter((r) => r.status !== "pending"),
    [requests]
  );

  const pushToast = (type: "success" | "error", text: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const accept = (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    // Кому достанется смена (если открытая — Анне)
    const targetId = req.toEmployeeId || "e3";

    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
    );

    setShifts((prev) =>
      prev.map((s) =>
        s.swapRequestId === id
          ? { ...s, employeeId: targetId, status: "swapped", swapRequestId: undefined }
          : s
      )
    );

    const fromEmp = EMPLOYEES.find((e) => e.id === req.fromEmployeeId);
    pushToast("success", `Обмен принят — смена ${fromEmp?.name} перешла к вам`);
    interact();
  };

  const decline = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "declined" } : r))
    );

    setShifts((prev) =>
      prev.map((s) =>
        s.swapRequestId === id
          ? { ...s, status: "normal", swapRequestId: undefined }
          : s
      )
    );

    pushToast("error", "Запрос на обмен отклонён");
    interact();
  };

  const resetAll = () => {
    setRequests(INITIAL_REQUESTS);
    setShifts(INITIAL_SHIFTS);
    setToasts([]);
  };

  return (
    <div className="bg-white rounded-xl relative">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-brand-600" />
            Обмены сменами
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {pending.length > 0 ? (
              <>
                <span className="text-amber-700 font-medium">
                  {pending.length} ждёт ответа
                </span>
                {history.length > 0 && (
                  <span className="text-slate-400">
                    {" "}
                    · {history.length} в истории
                  </span>
                )}
              </>
            ) : (
              <span className="text-emerald-600 font-medium">
                Все запросы обработаны
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 font-medium">
            <Clock className="w-3.5 h-3.5" />
            {pending.length} ожидает
          </div>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Требуют ответа
          </div>
          <div className="space-y-2.5">
            {pending.map((r) => (
              <PendingCard
                key={r.id}
                request={r}
                onAccept={() => accept(r.id)}
                onDecline={() => decline(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            История
          </div>
          <div className="space-y-1.5">
            {history.map((r) => (
              <HistoryRow key={r.id} request={r} />
            ))}
          </div>
        </div>
      )}

      {/* Пусто */}
      {pending.length === 0 && history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Inbox className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm">Пока нет ни одного обмена</p>
        </div>
      )}

      {/* Мини-график смен */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            График на неделю
          </h4>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
              Обычная
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-400 animate-pulse" />
              На обмене
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              Обменяна
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[640px]">
            {/* Шапка дней */}
            <div className="grid grid-cols-[110px_repeat(7,1fr)] gap-1 mb-1">
              <div className="text-[10px] text-slate-400 font-medium pl-1">Сотрудник</div>
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] text-slate-500 font-bold uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Строки сотрудников */}
            {EMPLOYEES.map((emp) => (
              <div
                key={emp.id}
                className="grid grid-cols-[110px_repeat(7,1fr)] gap-1 mb-1 items-stretch"
              >
                <div className="flex items-center gap-1.5 pr-2 min-w-0">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 truncate">
                    {emp.name.split(" ")[0]}
                  </span>
                </div>

                {/* Дни */}
                {WEEKDAYS.map((_, dayIdx) => {
                  const shift = shifts.find(
                    (s) => s.employeeId === emp.id && s.dayIndex === dayIdx
                  );
                  return (
                    <div
                      key={dayIdx}
                      className="h-10 bg-slate-50 rounded-md border border-slate-100 relative"
                    >
                      {shift && (
                        <div
                          className={`absolute inset-0.5 rounded flex items-center justify-center text-[9px] font-semibold transition-all ${
                            shift.status === "pending"
                              ? "ring-2 ring-amber-400 animate-pulse z-10"
                              : shift.status === "swapped"
                              ? "ring-2 ring-emerald-400 z-10"
                              : ""
                          }`}
                          style={{
                            backgroundColor: emp.color + "20",
                            borderLeft: `3px solid ${emp.color}`,
                            color: emp.color,
                          }}
                        >
                          {shift.status === "pending" && (
                            <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5 shrink-0 text-amber-600" />
                          )}
                          {shift.status === "swapped" && (
                            <Check className="w-2.5 h-2.5 mr-0.5 shrink-0 text-emerald-600" />
                          )}
                          <span className="truncate">{shift.time}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Подсказка + сброс */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Примите или отклоните — график обновится внизу
          </span>
          <span className="sm:hidden">💡 Нажмите Принять или Отклонить</span>
        </div>
        <button
          onClick={resetAll}
          className="text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors"
        >
          Сбросить демо
        </button>
      </div>

      {/* Toasts */}
      <div className="absolute bottom-4 right-4 space-y-2 pointer-events-none z-30">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pending карточка ──────────────────────────────
function PendingCard({
  request,
  onAccept,
  onDecline,
}: {
  request: SwapRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const from = EMPLOYEES.find((e) => e.id === request.fromEmployeeId)!;
  const to = request.toEmployeeId
    ? EMPLOYEES.find((e) => e.id === request.toEmployeeId)!
    : null;

  return (
    <div className="relative bg-white border-2 border-amber-200 rounded-xl p-4 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400" />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar employee={from} size="lg" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {from.name}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {from.position}
            </div>
          </div>
        </div>

        <ArrowRightLeft className="w-5 h-5 text-slate-300 shrink-0 hidden sm:block" />

        <div className="flex items-center gap-2 min-w-0">
          {to ? (
            <>
              <Avatar employee={to} size="lg" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {to.name}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {to.position}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-500 italic">
                  Открытая смена
                </div>
                <div className="text-xs text-slate-400">Любой сотрудник</div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-[180px] sm:ml-4 ml-0 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-slate-700 font-medium">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              {request.shiftDate}
            </div>
            <div className="flex items-center gap-1 text-slate-700 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {request.shiftTime}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {request.templateName}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Принять</span>
          </button>
          <button
            onClick={onDecline}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Отклонить</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History row ───────────────────────────────────
function HistoryRow({ request }: { request: SwapRequest }) {
  const from = EMPLOYEES.find((e) => e.id === request.fromEmployeeId)!;
  const to = request.toEmployeeId
    ? EMPLOYEES.find((e) => e.id === request.toEmployeeId)!
    : null;

  const isApproved = request.status === "approved";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isApproved
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-rose-50/50 border-rose-200"
      }`}
    >
      <Avatar employee={from} size="sm" />
      <div className="text-sm text-slate-700 min-w-0 flex-1">
        <span className="font-medium text-slate-900">{from.name}</span>
        <span className="text-slate-400 mx-1.5">→</span>
        {to ? (
          <span className="font-medium text-slate-900">{to.name}</span>
        ) : (
          <span className="italic text-slate-500">Открытая</span>
        )}
        <span className="text-slate-400 mx-1.5">·</span>
        <span className="text-slate-500">{request.shiftDate}</span>
        <span className="text-slate-400 mx-1">·</span>
        <span className="text-slate-500">{request.shiftTime}</span>
      </div>

      <div
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          isApproved
            ? "bg-emerald-100 text-emerald-800"
            : "bg-rose-100 text-rose-800"
        }`}
      >
        {isApproved ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <XCircle className="w-3.5 h-3.5" />
        )}
        {isApproved ? "Принят" : "Отклонён"}
      </div>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────
function Avatar({
  employee,
  size = "md",
}: {
  employee: Employee;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-10 h-10 text-sm" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: employee.color }}
    >
      {employee.name.charAt(0)}
    </div>
  );
}