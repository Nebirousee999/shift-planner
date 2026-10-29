import { useEffect, useState } from "react";
import { Plus, X, Trash2, Stethoscope, Pencil, Check } from "lucide-react";
import { useSickLeaves } from "../store/sickLeaves";
import { useUsers } from "../store/users";
import { alertDialog, confirmDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import VacationsGantt from "../components/VacationsGantt";
import type { SickLeave } from "../api/sickLeaves";
import type { Vacation } from "../api/vacations";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatDateRU(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].toLowerCase()}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

// Приводим SickLeave к Vacation-совместимому виду для ганта
function toGanttVacation(s: SickLeave): Vacation {
  return {
    id: s.id,
    orgId: "",
    userId: s.userId,
    startDate: s.startDate,
    endDate: s.endDate,
    comment: s.comment,
    status: "APPROVED",
    previousStartDate: null,
    previousEndDate: null,
    previousComment: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: s.createdAt ?? new Date().toISOString(),
    userName: s.userName,
  };
}

export default function SickLeavesPage() {
  const { all, loading, fetchAll, create, update, remove } = useSickLeaves();
  const { items: users, fetch: fetchUsers } = useUsers();

  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ userId: "", startDate: "", endDate: "", comment: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchUsers();
  }, [fetchAll, fetchUsers]);

  const resetForm = () => {
    setForm({ userId: "", startDate: "", endDate: "", comment: "" });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (s: SickLeave) => {
    if (!editMode) return;
    setEditingId(s.id);
    setForm({
      userId: s.userId,
      startDate: String(s.startDate).slice(0, 10),
      endDate: String(s.endDate).slice(0, 10),
      comment: s.comment ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

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
      if (editingId) {
        await update(editingId, {
          startDate: form.startDate,
          endDate: form.endDate,
          comment: form.comment || null,
        });
      } else {
        await create({
          userId: form.userId,
          startDate: form.startDate,
          endDate: form.endDate,
          comment: form.comment || undefined,
        });
      }
      closeForm();
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка сохранения", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirmDialog("Удалить запись о больничном?", { variant: "danger" });
    if (!ok) return;
    try { await remove(id); }
    catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка удаления", { variant: "error" });
    }
  };

  const onGanttUpdate = async (id: string, payload: { startDate: string; endDate: string }) => {
    try {
      await update(id, { startDate: payload.startDate, endDate: payload.endDate });
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка", { variant: "error" });
    }
  };

  const barTooltip = (v: Vacation): string => {
    const s = all.find((x) => x.id === v.id);
    if (!s) return `${formatDateRU(v.startDate)} — ${formatDateRU(v.endDate)}`;

    const lines = [
      `Больничный: ${formatDateRU(s.startDate)} — ${formatDateRU(s.endDate)}`,
    ];
    if (s.comment) lines.push(`Комментарий: ${s.comment}`);

    if (s.createdAt) {
      const who = s.createdByName ? ` (${s.createdByName})` : "";
      lines.push(`Создано: ${formatDateTime(s.createdAt)}${who}`);
    }
    if (s.updatedAt && s.updatedAt !== null) {
      const who = s.updatedByName ? ` (${s.updatedByName})` : "";
      lines.push(`Изменено: ${formatDateTime(s.updatedAt)}${who}`);
    }

    return lines.join("\n");
  };

  const ganttUsers = users.map((u) => ({ id: u.id, name: u.name }));
  const ganttVacations = all.map(toGanttVacation);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Больничные</h1>
            <p className="text-sm text-slate-500 mt-1">Учёт отсутствия сотрудников по болезни</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setEditMode((v) => !v); closeForm(); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                editMode
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {editMode ? <><Check className="w-4 h-4" /> Готово</> : <><Pencil className="w-4 h-4" /> Редактировать</>}
            </button>

            {editMode && (
              <button
                onClick={showForm && !editingId ? closeForm : openCreate}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${
                  showForm && !editingId
                    ? "bg-slate-200 text-slate-700"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                }`}
              >
                {showForm && !editingId ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Добавить больничный</>}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-rose-500" />
              {editingId ? "Редактировать запись" : "Новая запись"}
            </h3>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Сотрудник</label>
                  <select
                    value={form.userId}
                    onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                    disabled={!!editingId}
                  >
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
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  {busy ? "Сохранение..." : "Сохранить"}
                </button>
                <button type="button" onClick={closeForm} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {users.length > 0 && all.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <VacationsGantt
              users={ganttUsers}
              vacations={ganttVacations}
              canEdit={() => editMode}
              onBarClick={(v) => {
                if (!editMode) return;
                const s = all.find((x) => x.id === v.id);
                if (s) openEdit(s);
              }}
              onUpdate={editMode ? onGanttUpdate : undefined}
              barTooltip={barTooltip}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500 h-[50vh] flex items-center justify-center">
            {loading ? "Загрузка..." : "Нет данных для отображения таблицы"}
          </div>
        )}

        {/* Список для удаления — компактный, снизу, только в режиме редактирования */}
        {editMode && all.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-900">Все записи</div>
            <div className="divide-y divide-slate-100 max-h-[30vh] overflow-y-auto">
              {all.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{item.userName}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {formatDateRU(item.startDate)} — {formatDateRU(item.endDate)}
                      {item.comment && ` · ${item.comment}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(item)}
                      className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}