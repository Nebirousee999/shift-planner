import { useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Users, Lock, X } from "lucide-react";
import { useLocations } from "../store/locations";
import { useOrganization } from "../store/organization";
import { locationsApi, type Location, type LocationEmployee } from "../api/locations";
import { usersApi, type TeamUser } from "../api/users";
import { alertDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";

export default function LocationsPage() {
  const { items, fetch, create, update } = useLocations();
  const org = useOrganization((s) => s.org);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [assignTo, setAssignTo] = useState<Location | null>(null);

  const max = org?.maxLocations ?? 1;
  const canCreateMore = items.length < max;

  useEffect(() => { fetch(); }, [fetch]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editing) await update(editing.id, form);
      else await create(form);
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", address: "", city: "", phone: "" });
    } catch (e: any) {
      const code = e.response?.data?.code;
      if (code === "LOCATION_LIMIT_REACHED") {
        await alertDialog(
          "На вашем тарифе доступна только одна точка. Обновите тариф, чтобы добавить больше.",
          { title: "Лимит точек", variant: "error" }
        );
      } else {
        await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Точки</h1>
            <p className="text-sm text-slate-500 mt-1">
              Филиалы и адреса. У каждой точки — своё расписание.
            </p>
          </div>
          {canCreateMore ? (
            <button
              onClick={() => { setEditing(null); setForm({ name: "", address: "", city: "", phone: "" }); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Добавить точку
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed"
              title="Обновите тариф"
            >
              <Lock className="w-4 h-4" />
              Лимит: {max}
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4">
              {editing ? "Редактировать точку" : "Новая точка"}
            </h3>
            <form onSubmit={onSubmit} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Название" required />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Город" />
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Телефон" />
              </div>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Адрес" />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium">
                  {busy ? "..." : "Сохранить"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((loc) => (
            <div key={loc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{loc.name}</div>
                  {loc.city && <div className="text-xs text-slate-500">{loc.city}</div>}
                </div>
              </div>
              {loc.address && <div className="text-sm text-slate-600 mb-1">{loc.address}</div>}
              {loc.phone && <div className="text-sm text-slate-500">{loc.phone}</div>}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => setAssignTo(loc)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                  <Users className="w-3.5 h-3.5" /> Сотрудники
                </button>
                <button
                  onClick={() => { setEditing(loc); setForm({ name: loc.name, address: loc.address ?? "", city: loc.city ?? "", phone: loc.phone ?? "" }); setShowForm(true); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 ml-auto"
                >
                  <Pencil className="w-3.5 h-3.5" /> Изменить
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {assignTo && <AssignEmployeesModal location={assignTo} onClose={() => setAssignTo(null)} />}
    </div>
  );
}

function AssignEmployeesModal({ location, onClose }: { location: Location; onClose: () => void }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([usersApi.list(), locationsApi.getEmployees(location.id)])
      .then(([all, assigned]) => {
        setUsers(all);
        setSelected(new Set(assigned.map((a: LocationEmployee) => a.id)));
      })
      .finally(() => setLoading(false));
  }, [location.id]);

  const onSave = async () => {
    setSaving(true);
    try {
      await locationsApi.setEmployees(location.id, Array.from(selected));
      onClose();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Сотрудники точки</h3>
            <p className="text-xs text-slate-500 mt-0.5">{location.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Загрузка...</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 mb-4">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(u.id);
                    else next.delete(u.id);
                    setSelected(next);
                  }}
                  className="!w-4 !h-4 !p-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{u.name}</div>
                  <div className="text-xs text-slate-500 truncate">{u.position || "—"} · {u.email}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button onClick={onSave} disabled={saving || loading} className="flex-1 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium">
            {saving ? "..." : `Сохранить (${selected.size})`}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}