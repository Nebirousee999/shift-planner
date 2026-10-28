import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, Loader2, CalendarDays, Clock, AlertTriangle,
} from "lucide-react";
import { timesheetApi, type TimesheetResponse, type TimesheetCellStatus } from "../api/timesheet";
import { exportApi } from "../api/export";
import NavBar from "../components/NavBar";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const STATUS_META: Record<Exclude<TimesheetCellStatus, null>, { label: string; bg: string; text: string; title: string }> = {
  YA: { label: "Я",   bg: "bg-emerald-100", text: "text-emerald-800", title: "Явка" },
  V:  { label: "В",   bg: "bg-slate-100",   text: "text-slate-500",   title: "Выходной" },
  VV: { label: "ВВ",  bg: "bg-slate-100",   text: "text-slate-500",   title: "Выходной (оклад)" },
  B:  { label: "Б",   bg: "bg-blue-100",    text: "text-blue-800",    title: "Больничный" },
  OT: { label: "ОТ",  bg: "bg-amber-100",   text: "text-amber-800",   title: "Отпуск" },
  NN: { label: "НН",  bg: "bg-yellow-100",  text: "text-yellow-800",  title: "Неявка (неизвестная причина)" },
  PR: { label: "ПР",  bg: "bg-rose-100",    text: "text-rose-800",    title: "Прогул" },
};

const fmtMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export default function TimesheetPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState<TimesheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    timesheetApi.get(year, month)
      .then(setData)
      .catch((e) => alert(e.response?.data?.error ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const onExport = async () => {
    setExporting(true);
    try { await exportApi.downloadTimesheet(year, month); }
    catch (e: any) { alert(e.message ?? "Ошибка экспорта"); }
    finally { setExporting(false); }
  };

  const filteredUsers = data?.users.filter((u) =>
    !search.trim() || u.name.toLowerCase().includes(search.toLowerCase().trim())
  ) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-[1700px] mx-auto px-2 sm:px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Табель</h1>
            <p className="text-sm text-slate-500 mt-1">Электронный табель за месяц</p>
          </div>
          <button onClick={onExport} disabled={exporting || !data}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Скачать Excel
          </button>
        </div>

        {/* Предупреждение, если учёт выключен */}
        {data && !data.timeTrackingOn && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 flex items-start gap-2 text-xs text-blue-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Учёт рабочего времени <b>выключен</b>. Явки проставляются из данных дисциплины
              (по умолчанию — «Я», если смена прошла; «НН»/«ПР» — если отмечено в дисциплине).
            </div>
          </div>
        )}

        {/* Навигация */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-slate-900 min-w-[180px] text-center">
              {MONTHS_RU[month]} {year}
            </div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
              Текущий месяц
            </button>
          </div>
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени..." className="!w-56 !text-sm" />
          </div>
          {data && (
            <div className="flex gap-4 text-sm">
              <div><span className="text-slate-500">Явок:</span> <b className="text-slate-900">{data.totals.attendance}</b></div>
              <div><span className="text-slate-500">Часов:</span> <b className="text-slate-900">{data.totals.hours}</b></div>
              <div><span className="text-slate-500">Начислено:</span> <b className="text-slate-900">{fmtMoney(data.totals.gross)}</b></div>
              <div><span className="text-slate-500">НДФЛ ({data.taxRate}%):</span> <b className="text-rose-600">{fmtMoney(data.totals.tax)}</b></div>
              <div><span className="text-slate-500">К выплате:</span> <b className="text-emerald-600">{fmtMoney(data.totals.net)}</b></div>
            </div>
          )}
        </div>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}

        {data && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              <table className="border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100">
                    <th className="sticky left-0 z-30 bg-slate-100 border-r border-b border-slate-300 px-3 py-3 text-left font-semibold text-slate-900 min-w-[240px]">
                      Сотрудник
                    </th>
                    <th className="sticky left-[240px] z-30 bg-slate-100 border-r border-b border-slate-300 px-3 py-3 text-left font-semibold text-slate-900 min-w-[170px]">
                      Должность / тип
                    </th>
                    {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => {
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
                      const isWeekend = dow === 0 || dow === 6;
                      return (
                        <th key={d}
                          className={`border-r border-b border-slate-300 px-1 py-1.5 text-center min-w-[44px] ${
                            isWeekend ? "bg-slate-200 text-rose-600" : "text-slate-700"
                          }`}>
                          <div className="text-[10px] font-normal opacity-70">{WEEKDAYS_SHORT[dow]}</div>
                          <div className="text-sm font-bold">{d}</div>
                        </th>
                      );
                    })}
                    <th className="border-l-2 border-b border-slate-300 px-3 py-3 text-center font-bold text-slate-900 bg-slate-100 min-w-[80px]">
                      Часы
                    </th>
                    <th className="border-b border-slate-300 px-3 py-3 text-center font-bold text-slate-900 bg-slate-100 min-w-[120px]">
                      Начислено
                    </th>
                    <th className="border-b border-slate-300 px-3 py-3 text-center font-bold text-slate-900 bg-slate-100 min-w-[120px]">
                      К выплате
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 px-3 py-2">
                        <div className="font-medium text-slate-900 text-sm truncate">{u.name}</div>
                        {u.employmentType === "GPH" && (
                          <div className="text-[10px] text-violet-700 font-semibold uppercase">ГПХ</div>
                        )}
                      </td>
                      <td className="sticky left-[240px] z-10 bg-white border-r border-b border-slate-200 px-3 py-2">
                        <div className="text-xs text-slate-700 truncate">{u.position || "—"}</div>
                        <div className="text-[11px] text-slate-500">
                          {u.paymentType === "HOURLY" ? "Почасовой" : "Оклад"} · {u.employmentType === "GPH" ? "ГПХ" : "Штат"}
                        </div>
                      </td>
                      {u.days.map((day) => {
                        const s = day.cell.status;
                        const meta = s ? STATUS_META[s] : null;
                        return (
                          <td key={day.date}
                            className={`border-r border-b border-slate-200 p-1 text-center ${
                              day.isWeekend && !meta ? "bg-slate-50" : ""
                            }`}>
                            {meta ? (
                              <div
                                className={`inline-flex items-center justify-center w-9 h-9 rounded ${meta.bg} ${meta.text} text-xs font-bold`}
                                title={`${meta.title}${day.cell.hours ? ` · ${day.cell.hours} ч` : ""}${day.cell.templateName ? ` · ${day.cell.templateName}` : ""}`}>
                                {meta.label}
                              </div>
                            ) : day.cell.templateName ? (
                              <div className="text-[10px] text-slate-400 truncate" title={day.cell.templateName}>
                                {day.cell.templateName}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-l-2 border-b border-slate-200 px-3 py-2 text-center font-bold text-slate-900 bg-slate-50/50">
                        {u.totalHours}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-700 bg-slate-50/50 whitespace-nowrap">
                        {fmtMoney(u.totalPayGross)}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2 text-right font-bold text-emerald-600 bg-slate-50/50 whitespace-nowrap">
                        {fmtMoney(u.totalPayNet)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={2} className="sticky left-0 z-10 bg-slate-100 border-r border-slate-300 px-3 py-3 text-slate-900 text-sm">
                      ИТОГО · {filteredUsers.length} сотр.
                    </td>
                    <td colSpan={data.daysInMonth} className="border-r border-slate-300 px-3 py-3 text-right pr-4 text-slate-500 text-xs font-normal">
                      Явок: {data.totals.attendance} · НДФЛ {data.taxRate}%: {fmtMoney(data.totals.tax)}
                    </td>
                    <td className="border-l-2 border-slate-300 px-3 py-3 text-center text-slate-900">
                      {data.totals.hours}
                    </td>
                    <td className="border-slate-300 px-3 py-3 text-right text-slate-900 whitespace-nowrap">
                      {fmtMoney(data.totals.gross)}
                    </td>
                    <td className="border-slate-300 px-3 py-3 text-right text-emerald-700 whitespace-nowrap">
                      {fmtMoney(data.totals.net)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Легенда */}
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          <span className="font-semibold text-slate-700">Обозначения:</span>
          {Object.entries(STATUS_META).map(([k, m]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded ${m.bg} ${m.text} flex items-center justify-center text-[10px] font-bold`}>
                {m.label}
              </div>
              {m.title}
            </div>
          ))}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <CalendarDays className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-900">Как определяется статус</div>
            <ul className="text-amber-800 mt-1 text-xs space-y-1 list-disc pl-4">
              <li><b>Я (Явка)</b> — смена проведена{data?.timeTrackingOn === false ? " (учёт времени выключен, «Я» по умолчанию)" : ", есть отметка прихода/ухода"}.</li>
              <li><b>В (Выходной)</b> — для почасовика в выходной/будний день без смены.</li>
              <li><b>ВВ (Выходной)</b> — для окладника в выходной (оплачивается окладом).</li>
              <li><b>Б (Больничный)</b> — есть запись больничного.</li>
              <li><b>ОТ (Отпуск)</b> — есть одобренный отпуск.</li>
              <li><b>НН (Неявка)</b> — причина отсутствия неизвестна (или смена прошла, но отметок нет при включённом учёте).</li>
              <li><b>ПР (Прогул)</b> — отмечено в дисциплине.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}