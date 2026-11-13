import { useEffect, useState, useMemo } from "react";
import { Database, Search, Filter, Loader2, Users, X, Trash2, Shield, User } from "lucide-react";
import { adminApi, type AdminUserInfo } from "../api/admin";
import NavBar from "../components/NavBar";
import { confirmDialog, alertDialog } from "../store/dialogs";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-violet-100 text-violet-700 ring-violet-200",
  MANAGER: "bg-blue-100 text-blue-700 ring-blue-200",
  EMPLOYEE: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function AdminDatabasePage() {
  const [data, setData] = useState<AdminUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Фильтры
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterOrg, setFilterOrg] = useState("");

  // Выделение
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadData = () => {
    setLoading(true);
    adminApi.getDatabase()
      .then(setData)
      .catch((e) => setError(e.response?.data?.error ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const uniqueOrgs = useMemo(() => {
    const set = new Set(data.map((u) => u.orgName));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (search && !row.email.toLowerCase().includes(search.toLowerCase()) && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRole && row.role !== filterRole) return false;
      if (filterOrg && row.orgName !== filterOrg) return false;
      return true;
    });
  }, [data, search, filterRole, filterOrg]);

  const resetFilters = () => {
    setSearch("");
    setFilterRole("");
    setFilterOrg("");
  };

  const hasFilters = !!(search || filterRole || filterOrg);

  // ─── Логика выделения ───
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => u.id)));
    }
  };

  const onDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ok = await confirmDialog(
      `Удалить выбранных пользователей (${selected.size})?\n\nВНИМАНИЕ! Это удалит их профили, смены и привязки навсегда.`,
      { title: "Удаление из базы", variant: "danger", confirmLabel: "Удалить" }
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await adminApi.deleteUsers(Array.from(selected));
      await alertDialog(`Успешно удалено: ${selected.size} профилей`, { variant: "success" });
      setSelected(new Set());
      loadData();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка удаления", { variant: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <div className="max-w-7xl mx-auto p-8 text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Шапка */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-7 h-7 text-brand-600" /> База пользователей
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Всего в системе: <b>{data.length}</b> пользователей
            </p>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
            <Filter className="w-4 h-4 text-brand-600" /> Фильтры
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по ФИО или email..."
                className="!pl-9 !text-sm w-full"
              />
            </div>
            
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="!text-sm">
              <option value="">Все роли</option>
              <option value="OWNER">Владельцы</option>
              <option value="MANAGER">Менеджеры</option>
              <option value="EMPLOYEE">Сотрудники</option>
            </select>

            <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} className="!text-sm">
              <option value="">Все организации</option>
              {uniqueOrgs.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {hasFilters && (
            <div className="flex justify-end mt-2">
              <button onClick={resetFilters} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-colors">
                <X className="w-3.5 h-3.5" /> Сбросить фильтры
              </button>
            </div>
          )}
        </div>

        {/* Плашка действий при выделении */}
        {selected.size > 0 && (
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-3 mb-4 flex items-center justify-between shadow-sm animate-fade-in">
            <div className="text-sm font-medium text-brand-900">
              Выбрано профилей: <b>{selected.size}</b>
            </div>
            <button
              onClick={onDeleteSelected}
              disabled={deleting}
              className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl hover:bg-rose-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? "Удаление..." : "Удалить выбранных"}
            </button>
          </div>
        )}

        {/* Таблица */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="!w-4 !h-4 !p-0 cursor-pointer accent-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3">Сотрудник</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Роль</th>
                  <th className="px-4 py-3">Организация</th>
                  <th className="px-4 py-3">Дата рег.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      Нет пользователей по выбранным фильтрам
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const isSelected = selected.has(row.id);
                    return (
                      <tr key={row.id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? "bg-brand-50/20" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.id)}
                            className="!w-4 !h-4 !p-0 cursor-pointer accent-brand-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.name}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${ROLE_COLORS[row.role]}`}>
                            {row.role === "OWNER" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {ROLE_LABELS[row.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{row.orgName}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(row.createdAt).toLocaleDateString("ru-RU")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
