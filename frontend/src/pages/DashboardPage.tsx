import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Calendar,
  CalendarDays,
  Clock,
  ArrowRight,
  Plus,
  UserPlus,
  FileText,
  Activity,
  Bell,
  Palmtree,
  ArrowLeftRight,
} from "lucide-react";
import { dashboardApi, type DashboardSummary } from "../api/dashboard";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import NavBar from "../components/NavBar";
import { fullDate } from "../lib/dates";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  LOCKED: "Заблокирован",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  LOCKED: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .summary()
      .then(setData)
      .catch(() => alert("Ошибка загрузки дашборда"))
      .finally(() => setLoading(false));
  }, []);

  const {
    vacationsPending,
    swapsIncoming,
    shiftChangesIncoming,
    refresh: refreshNotifications,
  } = useNotifications();

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30_000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const totalPending =
    vacationsPending + swapsIncoming + shiftChangesIncoming;

  const firstName =
    user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ═══ Уведомления о запросах, требующих решения ═══ */}
        {totalPending > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-6 animate-fade-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-amber-900">
                  Требуют вашего решения
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">
                  Есть запросы, которые ждут вашего действия
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold shrink-0">
                {totalPending}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shiftChangesIncoming > 0 && (
                <button
                  onClick={() => navigate("/weeks")}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">
                      Изменения смен
                    </div>
                    <div className="text-xs text-slate-500">
                      {shiftChangesIncoming}{" "}
                      {shiftChangesIncoming === 1 ? "запрос" : "запросов"}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </button>
              )}

              {vacationsPending > 0 && (
                <button
                  onClick={() => navigate("/vacations")}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Palmtree className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">
                      Изменения отпусков
                    </div>
                    <div className="text-xs text-slate-500">
                      {vacationsPending}{" "}
                      {vacationsPending === 1 ? "запрос" : "запросов"}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </button>
              )}

              {swapsIncoming > 0 && (
                <button
                  onClick={() => navigate("/swaps")}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">
                      Обмены сменами
                    </div>
                    <div className="text-xs text-slate-500">
                      {swapsIncoming}{" "}
                      {swapsIncoming === 1 ? "предложение" : "предложений"}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Приветствие */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-slate-900">
            Привет, {firstName} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Вот что происходит в вашем заведении прямо сейчас
          </p>
        </div>

        {loading && (
          <div className="text-slate-500 text-sm">Загрузка...</div>
        )}

        {data && (
          <>
            {/* ── Метрики ───────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                icon={Users}
                iconBg="bg-blue-50 text-blue-600"
                label="Сотрудников"
                value={data.userCount}
                onClick={() => navigate("/team")}
                showDot={vacationsPending > 0}
              />
              <MetricCard
                icon={Calendar}
                iconBg="bg-violet-50 text-violet-600"
                label="Шаблонов смен"
                value={data.templateCount}
                onClick={() => navigate("/templates")}
              />
              <MetricCard
                icon={CalendarDays}
                iconBg="bg-emerald-50 text-emerald-600"
                label="Недель"
                value={data.weekStats.total}
                hint={`${data.weekStats.draft} черновик · ${data.weekStats.published} опубликовано`}
                onClick={() => navigate("/weeks")}
                showDot={shiftChangesIncoming > 0}
              />
              <MetricCard
                icon={Clock}
                iconBg="bg-amber-50 text-amber-600"
                label="Часов за месяц"
                value={data.monthlyHours}
                onClick={() => navigate("/time")}
              />
            </div>

            {/* ── Ближайшая неделя + Сейчас работают ────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    Ближайшая неделя
                  </h3>
                </div>

                {!data.nextWeek && (
                  <div className="text-center py-6">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 mb-4">
                      Будущих недель пока нет
                    </p>
                    <button
                      onClick={() => navigate("/weeks")}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Создать неделю
                    </button>
                  </div>
                )}

                {data.nextWeek && (
                  <div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className="text-lg font-semibold text-slate-900">
                        {fullDate(data.nextWeek.weekStartDate)}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[data.nextWeek.status]
                        }`}
                      >
                        {STATUS_LABELS[data.nextWeek.status]}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mb-5">
                      {data.nextWeek.shiftsCount} смен запланировано
                    </div>
                    <button
                      onClick={() => navigate(`/weeks/${data.nextWeek!.id}`)}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
                    >
                      Открыть неделю
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    Сейчас работают
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium ml-auto ring-1 ring-emerald-200">
                    {data.workingNow.length}
                  </span>
                </div>

                {data.workingNow.length === 0 && (
                  <div className="text-center py-6">
                    <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                      Никто ещё не отметился на смену
                    </p>
                  </div>
                )}

                {data.workingNow.length > 0 && (
                  <div className="space-y-2">
                    {data.workingNow.map((w) => (
                      <div
                        key={w.entryId}
                        className="flex items-center justify-between text-sm bg-emerald-50/50 border-l-4 border-emerald-500 pl-3 py-2 rounded-r-lg"
                      >
                        <span className="font-medium text-slate-900">
                          {w.userName}
                        </span>
                        <span className="text-slate-500">
                          с {formatTime(w.clockIn)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Быстрые действия ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                Быстрые действия
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction
                  icon={Plus}
                  label="Создать неделю"
                  onClick={() => navigate("/weeks")}
                  primary
                />
                <QuickAction
                  icon={UserPlus}
                  label="Добавить сотрудника"
                  onClick={() => navigate("/team")}
                />
                <QuickAction
                  icon={Calendar}
                  label="Новый шаблон"
                  onClick={() => navigate("/templates")}
                />
                <QuickAction
                  icon={FileText}
                  label="Документы"
                  onClick={() => navigate("/documents")}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Компоненты карточек
// ─────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  iconBg,
  label,
  value,
  hint,
  onClick,
  showDot,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: number;
  hint?: string;
  onClick?: () => void;
  showDot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-left hover:shadow-md hover:border-slate-300 transition-all animate-fade-in"
    >
      {showDot && (
        <span
          className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"
          title="Требуется ваше решение"
        />
      )}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        primary
          ? "bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow"
          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}