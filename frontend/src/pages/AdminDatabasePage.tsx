import { useEffect, useState, useMemo } from "react";
import { Database, Search, Filter, Loader2, Users, X } from "lucide-react";
import { adminApi, type DbUserInfo } from "../api/admin";
import NavBar from "../components/NavBar";

const TARIFF_COLORS: Record<string, string> = {
  "Free": "bg-slate-100 text-slate-700 ring-slate-200",
  "Pro": "bg-brand-100 text-brand-700 ring-brand-200",
  "Business": "bg-violet-100 text-violet-700 ring-violet-200",
  "Trial (Pro)": "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

export default function AdminDatabasePage() {
  const [data, setData] = useState<DbUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры
  const [search, setSearch] = useState("");
  const [filterTariff, setFilterTariff] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterMinEmp, setFilterMinEmp] = useState("");
  const [filterMaxEmp, setFilterMaxEmp] = useState("");

  useEffect(() => {
    adminApi.getDatabase()
      .then(setData)
      .catch((e) => setError(e.response?.data?.error ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (search && !row.email.toLowerCase().includes(search.toLowerCase()) && !row.orgName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTariff && row.tariff !== filterTariff) return false;
      
      const rowDate = new Date(row.createdAt).toISOString().slice(0, 10);
      if (filterDateFrom && rowDate < filterDateFrom) return false;
      if (filterDateTo && rowDate > filterDateTo) return false;

      if (filterMinEmp && row.employeeCount < Number(filterMinEmp)) return false;
      if (filterMaxEmp && row.employeeCount > Number(filterMaxEmp)) return false;

      return true;
    });
  }, [data, search, filterTariff, filterDateFrom, filterDateTo, filterMinEmp, filterMaxEmp]);

  const resetFilters = () => {
    setSearch("");
    setFilterTariff("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterMinEmp("");
    setFilterMaxEmp("");
  };

  const hasFilters = !!(search || filterTariff || filterDateFrom || filterDateTo || filterMinEmp || filterMaxEmp);

  if (loading) {
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
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Шапка */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-7 h-7 text-brand-600" /> База данных
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Всего зарегистрировано: <b>{data.length}</b> организаций
            </p>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
            <Filter className="w-4 h-4 text-brand-600" /> Фильтры
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по email или имени..."
                className="!pl-9 !text-sm w-full"
              />
            </div>
            
            <select value={filterTariff} onChange={(e) => setFilterTariff(e.target.value)} className="!text-sm">
              <option value="">Все тарифы</option>
              <option value="Free">Free</option>
              <option value="Trial (Pro)">Trial (Pro)</option>
              <option value="Pro">Pro</option>
              <option value="Business">Business</option>
            </select>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 shrink-0">Сотрудники:</span>
              <input type="number" placeholder="От" value={filterMinEmp} onChange={(e) => setFilterMinEmp(e.target.value)} className="!text-sm w-16" />
              <span className="text-slate-400">—</span>
              <input type="number" placeholder="До" value={filterMaxEmp} onChange={(e) => setFilterMaxEmp(e.target.value)} className="!text-sm w-16" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 shrink-0">Дата с:</span>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="!text-sm w-full" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 shrink-0">по:</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="!text-sm w-full" />
            </div>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-slate-500 hover:text-slate-900 flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 transition-colors">
                <X className="w-3.5 h-3.5" /> Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Организация</th>
                  <th className="px-4 py-3">Владелец (Email)</th>
                  <th className="px-4 py-3">Дата регистрации</th>
                  <th className="px-4 py-3">Тариф</th>
                  <th className="px-4 py-3 text-center">Сотрудников</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      Нет данных по выбранным фильтрам
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.orgName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.email}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {new Date(row.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${TARIFF_COLORS[row.tariff] || TARIFF_COLORS["Free"]}`}>
                          {row.tariff}
                        </span>
                        {row.expiresAt && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            до {new Date(row.expiresAt).toLocaleDateString("ru-RU")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          <Users className="w-3 h-3 text-slate-400" /> {row.employeeCount}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
