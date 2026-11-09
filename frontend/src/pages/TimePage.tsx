import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Activity,
  Clock,
  Filter,
  X,
  Timer,
} from "lucide-react";
import { useTimeEntries } from "../store/timeEntries";
import { useUsers } from "../store/users";

import { useOrganization } from "../store/organization";
import NavBar from "../components/NavBar";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hh}:${mm}`;
}

function durationLabel(inIso: string | null, outIso: string | null): string {
  if (!inIso || !outIso) return "—";
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
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

export default function TimePage() {

  const org = useOrganization((s) => s.org);
  const timeTrackingOn = org?.timeTrackingEnabled === true;

  const {
    items,
    active,
    loading,
    error,
    fetch,
    fetchActive,
    clockIn,
    clockOut,
  } = useTimeEntries();
  const { items: users, fetch: fetchUsers } = useUsers();

  const [filterUserId, setFilterUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Не грузим данные, если учёт выключен
    if (!timeTrackingOn) return;
    fetchUsers();
    fetchActive();
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTrackingOn]);

  // ─── Заглушка, если учёт времени выключен ────────────
  if (!timeTrackingOn) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="font-semibold text-slate-900 mb-1 text-lg">
              Учёт времени выключен
            </h2>
            <p className="text-sm text-slate-500">
              Владелец аккаунта может включить его в{" "}
              <b>Профиль → Настройки</b>. Пока он выключен — часы для
              зарплаты считаются по графику смен.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const onFilter = () => {
    fetch({
      userId: filterUserId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  };

  const onReset = () => {
    setFilterUserId("");
    setFrom("");
    setTo("");
    fetch();
  };

  const onClockIn = async () => {
    setBusy(true);
    try {
      await clockIn();
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const onClockOut = async () => {
    setBusy(true);
    try {
      await clockOut();
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const nowWorking = items.filter((i) => i.clockIn && !i.clockOut);
  const closedEntries = items.filter((i) => i.clockIn && i.clockOut);

  // Считаем суммарные часы из закрытых смен
  const totalHours = closedEntries.reduce((sum, e) => {
    const ms = new Date(e.clockOut!).getTime() - new Date(e.clockIn!).getTime();
    return sum + ms / 3600000;
  }, 0);

  const filtersActive = !!(filterUserId || from || to);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок + кнопка */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Учёт времени
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Отмечайте начало и конец смены — часы считаются автоматически
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Filter className="w-4 h-4" />
            Фильтры
            {filtersActive && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-brand-500" />
            )}
          </button>

          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-3 items-end animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Сотрудник
                </label>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="!w-48"
                >
                  <option value="">Все</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  С даты
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="!w-40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  По дату
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="!w-40"
                />
              </div>
              <button
                onClick={onFilter}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 text-sm font-medium transition-colors"
              >
                Применить
              </button>
              {filtersActive && (
                <button
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Сбросить
                </button>
              )}
            </div>
          )}
        </div>

        {/* Сводка */}
        {(closedEntries.length > 0 || nowWorking.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Timer className="w-3.5 h-3.5" />
                Часов всего
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {Math.round(totalHours * 10) / 10}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5" />
                Записей
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {closedEntries.length}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Activity className="w-3.5 h-3.5" />
                Сейчас работают
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {nowWorking.length}
              </div>
            </div>
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Пустое состояние */}
        {!loading && closedEntries.length === 0 && nowWorking.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Пока нет ни одной отметки
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Нажмите «Начать смену» в шапке — система запишет время начала и
              конца
            </p>
            <button
              onClick={onClockIn}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              <Play className="w-4 h-4" />
              Начать первую смену
            </button>
          </div>
        )}

        {/* Блок «сейчас работают» */}
        {nowWorking.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Сейчас работают
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium ml-1 ring-1 ring-emerald-200">
                {nowWorking.length}
              </span>
            </h3>
            <div className="space-y-2">
              {nowWorking.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-sm bg-emerald-50/50 border-l-4 border-emerald-500 pl-3 py-2 rounded-r-lg"
                >
                  <span className="font-medium text-slate-900">
                    {entry.userName}
                  </span>
                  <span className="text-slate-500 text-xs">
                    с {formatDateTime(entry.clockIn)} ·{" "}
                    {elapsedSince(entry.clockIn!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Таблица закрытых смен */}
        {closedEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left">
                <tr>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Сотрудник
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Начало
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Окончание
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Отработано
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedEntries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-semibold shrink-0">
                          {(e.userName ?? "—")
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">
                          {e.userName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {formatDateTime(e.clockIn)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {formatDateTime(e.clockOut)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                        <Timer className="w-3.5 h-3.5 text-slate-400" />
                        {durationLabel(e.clockIn, e.clockOut)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading &&
          closedEntries.length === 0 &&
          nowWorking.length === 0 &&
          filtersActive && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center mt-4">
              <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                По выбранным фильтрам ничего не найдено
              </p>
            </div>
          )}
      </main>
    </div>
  );
}