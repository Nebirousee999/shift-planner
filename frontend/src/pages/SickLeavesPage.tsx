import { useEffect, useState } from "react";
import { Plus, X, Trash2, Stethoscope } from "lucide-react";
import { useSickLeaves } from "../store/sickLeaves";
import { useUsers } from "../store/users";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import VacationsGantt from "../components/VacationsGantt";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].toLowerCase().slice(0, 3)}`;
}

function avatarColor(id: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % colors.length;
  return colors[hash];
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function SickLeavesPage() {
  const { all, loading, fetchAll, create, remove } = useSickLeaves();
  const { items: users, fetch: fetchUsers } = useUsers();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", startDate: "", endDate: "", comment: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchUsers();
  }, [fetchAll, fetchUsers]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId || !form.startDate || !form.endDate) {
      await alertDialog("Заполните все обязательные поля", { variant: "error" });
      return;
    }
    if (form.startDate > form.endDate) {
      await alertDialog("Дата начала позже даты окончания", { variant: "error" });
      return;
    }

    setBusy(true);
    try {
      await create(form);
      setShowForm(false);
      setForm({ userId: "", startDate: "", endDate: "", comment: "" });
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка сохранения", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirmDialog("Удалить запись о больничном?", { variant: "danger" });
    if (!ok) return;
    try {
      await remove(id);
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка удаления", { variant: "error" });
    }
  };

  const ganttUsers = users.map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Больничные</h1>
            <p className="text-sm text-slate-500 mt-1">Учет отсутствия сотрудников по болезни</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${
              showForm ? "bg-slate-200 text-slate-700" : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {showForm ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Добавить больничный</>}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-rose-500" /> Новая запись
            </h3>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Сотрудник</label>
                  <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                    <option value="">— Выберите —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Дата начала</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Дата окончания</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Комментарий</label>
                <input value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Например: ОРВИ" maxLength={255} />
              </div>
              <button type="submit" disabled={busy} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors">
                {busy ? "Сохранение..." : "Сохранить"}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Таблица-гант */}
          <div className="lg:col-span-2">
            {users.length > 0 && all.length > 0 ? (
              <VacationsGantt
                users={ganttUsers}
                vacations={all.map(s => ({ ...s, status: "APPROVED", comment: s.comment ?? undefined }))}
                canEdit={() => false} // Больничные не редактируются перетаскиванием
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
                Нет данных для отображения таблицы
              </div>
            )}
          </div>

          {/* Список записей */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Последние записи</div>
              {all.length === 0 && !loading ? (
                <div className="p-6 text-center text-slate-500 text-sm">Нет записей</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {all.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${avatarColor(item.userId)}`}>
                          {initials(item.userName || "—")}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-sm truncate">{item.userName}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {formatShortDate(item.startDate)} — {formatShortDate(item.endDate)}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}