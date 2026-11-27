import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Palmtree, Check, Bell, Lock, Sparkles } from "lucide-react";
import { useVacations } from "../store/vacations";
import { useUsers } from "../store/users";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import { useOrganization } from "../store/organization";
import { vacationsApi, type Vacation } from "../api/vacations";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import VacationsGantt from "../components/VacationsGantt";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatDateRU(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].toLowerCase()}`;
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function VacationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const org = useOrganization((s) => s.org);
  const isDemo = localStorage.getItem("isGuest") === "true";
  const isTrial = org?.trialEndsAt && new Date(org.trialEndsAt) > new Date();
  const isPaid = org?.tariffExpiresAt && new Date(org.tariffExpiresAt) > new Date();
  const effectiveTariff = isTrial ? "pro" : (isPaid ? org?.tariffId : "free");
  const isFree = effectiveTariff === "free" && !isDemo;

  const { all, loading, error, fetchAll } = useVacations();
  const { items: users, fetch: fetchUsers } = useUsers();

  const [pending, setPending] = useState<Vacation[]>([]);
  const [moderating, setModerating] = useState<string | null>(null);

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";

  useEffect(() => {
    fetchAll();
    fetchUsers();
    if (isAdmin) {
      vacationsApi.listPending().then(setPending).catch(() => {});
    }
  }, [fetchAll, fetchUsers, isAdmin]);

  const onApprove = async (id: string) => {
    setModerating(id);
    try {
      await vacationsApi.approve(id);
      useNotifications.getState().refresh();
      setPending((prev) => prev.filter((p) => p.id !== id));
      await fetchAll();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setModerating(null);
    }
  };

  const onReject = async (id: string) => {
    const ok = await confirmDialog("Отклонить изменения отпуска?", {
      title: "Отклонение",
      confirmLabel: "Отклонить",
      variant: "danger",
    });
    if (!ok) return;

    setModerating(id);
    try {
      await vacationsApi.reject(id);
      useNotifications.getState().refresh();
      setPending((prev) => prev.filter((p) => p.id !== id));
      await fetchAll();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setModerating(null);
    }
  };

  const approvedVacations = all.filter((v) => v.status === "APPROVED");
  const ganttUsers = users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative">
        
        {/* Слой контента (размывается при Free) */}
        <div className={isFree ? "opacity-40 pointer-events-none select-none" : ""}>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Отпуска</h1>
              <p className="text-sm text-slate-500 mt-1">
                Календарь отпусков. Правки сотрудников приходят сюда на
                согласование.
              </p>
            </div>
          </div>

          {isAdmin && pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-amber-900">
                    Требуют одобрения
                  </h2>
                  <p className="text-xs text-amber-700">
                    Сотрудники изменили свои отпуска — проверьте и одобрите
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                  {pending.length}
                </span>
              </div>

              <div className="space-y-2">
                {pending.map((p) => {
                  const isEdit = !!p.previousStartDate;
                  const busy = moderating === p.id;

                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-amber-200 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(p.userId)}`}>
                            {initials(p.userName ?? "—")}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {p.userName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {isEdit
                                ? "Изменил(а) свой отпуск"
                                : "Запросил(а) новый отпуск"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onApprove(p.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {busy ? "..." : "Одобрить"}
                          </button>
                          <button
                            onClick={() => onReject(p.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Отклонить
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {isEdit && (
                          <div className="bg-slate-50 rounded-lg p-3 opacity-50 border border-slate-200">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                              Было
                            </div>
                            <div className="text-sm text-slate-700 line-through">
                              {formatDateRU(p.previousStartDate!)} —{" "}
                              {formatDateRU(p.previousEndDate!)}
                            </div>
                            {p.previousComment && (
                              <div className="text-xs text-slate-500 mt-1 line-through">
                                {p.previousComment}
                              </div>
                            )}
                          </div>
                        )}

                        <div className={`bg-emerald-50 rounded-lg p-3 border-2 border-emerald-300 ${!isEdit ? "md:col-span-2" : ""}`}>
                          <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                            {isEdit ? "Стало" : "Новый отпуск"}
                          </div>
                          <div className="text-sm font-medium text-slate-900">
                            {formatDateRU(p.startDate)} —{" "}
                            {formatDateRU(p.endDate)}
                          </div>
                          {p.comment && (
                            <div className="text-xs text-slate-600 mt-1">
                              {p.comment}
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

          {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}

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

          {/* Таблица отпусков (Gantt) */}
          {users.length > 0 && (
            <VacationsGantt
              users={ganttUsers}
              vacations={approvedVacations}
            />
          )}
        </div>

        {/* Слой блокировки (поверх всего) */}
        {isFree && (
          <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 sm:pt-32 pointer-events-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-8 text-center animate-fade-in mx-4">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Доступно только для Pro</h2>
              <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                Управление отпусками и больничными, а также создание заявок на согласование доступно на тарифе Pro.
              </p>
              <button
                onClick={() => navigate("/wallet?trial=true")}
                className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 mb-3"
              >
                <Sparkles className="w-5 h-5" /> Разблокировать на 14 дней
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
