import { useEffect, useState, useMemo } from "react";
import {
  ArrowRightLeft,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Inbox,
  CalendarDays,
  Check,
  X,
  Trash2,
  Eye
} from "lucide-react";
import { useSwaps } from "../store/swaps";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../store/notifications";
import { swapsApi } from "../api/swaps";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";

type Tab = "all" | "PENDING" | "APPROVED" | "DENIED";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Все", icon: ArrowRightLeft },
  { id: "PENDING", label: "Ожидают", icon: AlertCircle },
  { id: "APPROVED", label: "Одобрены", icon: CheckCircle2 },
  { id: "DENIED", label: "Отклонены", icon: XCircle },
];

const STATUS_META: Record<
  string,
  { label: string; badge: string; bar: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Ожидает",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    bar: "bg-amber-500",
    icon: AlertCircle,
  },
  APPROVED: {
    label: "Одобрен",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    bar: "bg-emerald-500",
    icon: CheckCircle2,
  },
  DENIED: {
    label: "Отклонён",
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    bar: "bg-red-500",
    icon: XCircle,
  },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hh}:${mm}`;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function SwapsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const {
    all: adminAll,
    available,
    outgoing,
    loading,
    error,
    fetchAll,
    fetchAvailable,
    fetchMine,
  } = useSwaps();

  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (isAdmin) fetchAll();
    else {
      fetchAvailable();
      fetchMine(); // Загружаем свои исходящие запросы
    }
  }, [isAdmin, fetchAll, fetchAvailable, fetchMine]);

  // Объединяем доступные для меня обмены и мои собственные
  const all = useMemo(() => {
    if (isAdmin) return adminAll;
    const map = new Map();
    for (const a of available) map.set(a.id, a);
    for (const o of outgoing) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [isAdmin, adminAll, available, outgoing]);

  const filtered = useMemo(() => {
    if (tab === "all") return all;
    return all.filter((r) => r.status === tab);
  }, [all, tab]);

  const counts = useMemo(() => {
    return {
      all: all.length,
      PENDING: all.filter((r) => r.status === "PENDING").length,
      APPROVED: all.filter((r) => r.status === "APPROVED").length,
      DENIED: all.filter((r) => r.status === "DENIED").length,
    };
  }, [all]);

  const reload = async () => {
    await (isAdmin ? fetchAll() : fetchAvailable());
    if (!isAdmin) await fetchMine();
    useNotifications.getState().refresh();
  };

  const onAccept = async (id: string) => {
    try {
      await swapsApi.accept(id);
      await reload();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  const onDecline = async (id: string) => {
    const req = all.find(r => r.id === id);
    if (!req) return;
    const isOpen = !req.swapWithUserId;

    const ok = await confirmDialog(isOpen ? "Скрыть этот обмен из списка?" : "Отклонить запрос на обмен?", {
      title: isOpen ? "Скрыть" : "Отклонение",
      variant: "danger",
      confirmLabel: isOpen ? "Скрыть" : "Отклонить"
    });
    if (!ok) return;

    try {
      await swapsApi.decline(id);
      await reload();
      if (!isOpen) {
        setTab("DENIED"); // Переключаем только если это был адресный обмен
      }
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  const onCancel = async (id: string) => {
    const ok = await confirmDialog("Отменить ваш запрос на обмен?", {
      title: "Отмена",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await swapsApi.cancel(id);
      await reload();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Обмены смен</h1>
          <p className="text-sm text-slate-500 mt-1">
            История предложений обмена сменами между сотрудниками
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              {tab === "all" ? (
                <Inbox className="w-8 h-8 text-slate-400" />
              ) : (
                <ArrowRightLeft className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              {tab === "all" ? "Пока нет ни одного обмена" : "Здесь пока пусто"}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {tab === "all"
                ? "Когда сотрудники начнут предлагать обмен сменами, запросы появятся здесь"
                : "Нет запросов с таким статусом"}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status];
              const StatusIcon = meta.icon;
              const isMyRequest = r.requestedBy === user?.id;
              const canModerate = r.status === "PENDING";

              return (
                <div
                  key={r.id}
                  className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden animate-fade-in"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bar}`}
                  />

                  <div className="p-5 pl-6 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5 text-slate-600" />
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {r.shiftDate ? shortDate(r.shiftDate) : "Смена удалена"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          {r.startTime && r.endTime ? (
                            <>
                              <Clock className="w-3 h-3" />
                              {r.startTime}–{r.endTime}
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <PersonChip
                        name={r.requestedByName ?? "—"}
                        label="От"
                      />
                      <ArrowRightLeft className="w-4 h-4 text-slate-300 shrink-0" />
                      <PersonChip
                        name={r.swapWithName ?? "Открытая"}
                        label="Кому"
                        muted={!r.swapWithName}
                      />
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-xs text-slate-400 hidden md:block">
                        {formatDateTime(r.createdAt)}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${meta.badge}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>

                      <button
                        onClick={() => {
                          if (r.weekId) navigate(`/weeks/${r.weekId}`);
                          else navigate("/weeks");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                        title="Посмотреть в расписании"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Посмотреть</span>
                      </button>

                      {canModerate && (
                        <div className="flex items-center gap-1.5">
                          {isMyRequest ? (
                            <button
                              onClick={() => onCancel(r.id)}
                              className="inline-flex items-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              title="Отменить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Отменить</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => onAccept(r.id)}
                                className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
                                title="Принять"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Принять</span>
                              </button>
                              <button
                                onClick={() => onDecline(r.id)}
                                className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                title="Отклонить"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Отклонить</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function PersonChip({
  name,
  label,
  muted,
}: {
  name: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          muted ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-600"
        }`}
      >
        {muted ? <User className="w-3.5 h-3.5" /> : initials(name)}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">
          {label}
        </div>
        <div
          className={`text-sm font-medium truncate ${
            muted ? "text-slate-400 italic" : "text-slate-900"
          }`}
        >
          {name}
        </div>
      </div>
    </div>
  );
}