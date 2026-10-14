import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  CalendarDays,
} from "lucide-react";
import { exportApi } from "../api/export";
import NavBar from "../components/NavBar";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default function TimesheetPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [loading, setLoading] = useState(false);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const onExport = async () => {
    setLoading(true);
    try {
      await exportApi.downloadTimesheet(year, month);
    } catch (e: any) {
      alert(e.message ?? "Ошибка экспорта");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Табель</h1>
          <p className="text-sm text-slate-500 mt-1">
            Выгрузка часов и зарплаты за месяц — для бухгалтера
          </p>
        </div>

        {/* Выбор месяца */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Выберите месяц
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-xl font-semibold text-slate-900 min-w-[200px] text-center">
              {MONTHS_RU[month]} {year}
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Следующий месяц"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToday}
              className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
            >
              Текущий месяц
            </button>
          </div>
        </div>

        {/* Превью содержимого */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                Что будет в файле
              </h3>
              <ul className="text-sm text-slate-500 mt-2 space-y-1">
                <li>• Список сотрудников со ставками</li>
                <li>• Отработанные часы по каждому дню месяца</li>
                <li>• Итог по часам за месяц</li>
                <li>• Сумма к выплате (часы × ставка)</li>
                <li>• Общий итог по всем сотрудникам</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Кнопка экспорта */}
        <button
          onClick={onExport}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-3.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
        >
          <Download className="w-4 h-4" />
          {loading ? "Формирование..." : `Скачать табель за ${MONTHS_RU[month]} ${year}`}
        </button>

        <p className="text-xs text-slate-400 mt-3 text-center">
          Файл скачается в формате Excel (.xlsx) — откроется в Excel,
          LibreOffice или Google Sheets
        </p>

        {/* Подсказка */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6 flex items-start gap-3">
          <CalendarDays className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-900">
              Часы считаются по назначенным сменам
            </div>
            <div className="text-amber-700 mt-0.5">
              Если сотрудник отработал смену, но она не была запланирована — он
              не попадёт в табель. Отметки clock-in/out в учёте времени — это
              отдельный модуль, для сверки «план vs факт».
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}