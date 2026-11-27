import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { History, Loader2, X } from "lucide-react";
import { historyApi } from "../api/history";
import NavBar from "../components/NavBar";

export default function HistoryPage() {
  const isGuest = localStorage.getItem("isGuest") === "true";
  if (isGuest) return <Navigate to="/analytics" replace />;

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hFrom, setHFrom] = useState("");
  const [hTo, setHTo] = useState("");
  const [hType, setHType] = useState("");

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    historyApi.list({ from: hFrom, to: hTo, type: hType })
      .then((res) => { if (!cancelled) setHistoryData(res); })
      .catch((e) => { if (!cancelled) console.error(e); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [hFrom, hTo, hType]);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">История действий</h1>
          <p className="text-sm text-slate-500 mt-1">Лента событий и изменений в системе</p>
        </div>

        <div className="space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex gap-2 items-center text-sm">
              <span className="text-slate-500">Период:</span>
              <input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)} className="!w-auto !py-1.5" />
              <span className="text-slate-400">—</span>
              <input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)} className="!w-auto !py-1.5" />
            </div>
            <div className="flex gap-2 items-center text-sm">
              <span className="text-slate-500">Действие:</span>
              <select value={hType} onChange={(e) => setHType(e.target.value)} className="!w-auto !py-1.5">
                <option value="">Все действия</option>
                <option value="PUBLISH">Публикация расписания</option>
                <option value="DISCIPLINE">Изменение дисциплины</option>
                <option value="SHIFT_CREATE">Создание смен</option>
                <option value="SHIFT_UPDATE">Изменение смен</option>
                <option value="VACATION">Отпуска</option>
                <option value="SICK_LEAVE">Больничные</option>
                <option value="TIME_OFF">Отгулы</option>
                <option value="SWAP">Обмены сменами</option>
              </select>
            </div>
            {(hFrom || hTo || hType) && (
              <button onClick={() => { setHFrom(""); setHTo(""); setHType(""); }} className="text-xs text-slate-500 hover:text-slate-900 ml-auto flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Сбросить фильтры
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" /> Лента событий
            </div>
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {historyLoading ? (
                <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка...</div>
              ) : historyData.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Нет событий за выбранный период</div>
              ) : historyData.map((h: any) => (
                <div key={h.id} className="p-4 hover:bg-slate-50 flex items-start gap-4">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900">{h.description}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Автор: <span className="font-medium text-slate-700">{h.userName}</span> · {new Date(h.createdAt).toLocaleString("ru-RU")}</div>
                  </div>
                  <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide shrink-0">{h.actionType}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}