import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Данные ────────────────────────────────────────
const EMPLOYEES = [
  { id: "e1", name: "Мария Иванова", position: "продавец", rate: 500 },
  { id: "e2", name: "Иван Петров", position: "повар", rate: 600 },
  { id: "e3", name: "Анна Сидорова", position: "официант", rate: 450 },
];

type Status = "work" | "weekend" | "vacation" | "sick";

type DayData = {
  day: number;
  status: Status;
  hours: number;
};

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Генерируем сетку для Сентября 2026 (1 сентября — вторник)
const generateMonth = (): DayData[] => {
  const days: DayData[] = [];
  for (let i = 1; i <= 30; i++) {
    const date = new Date(2026, 8, i); // 8 = Сентябрь
    const dow = date.getDay(); // 0 = Вс, 6 = Сб
    const isWeekend = dow === 0 || dow === 6;
    days.push({
      day: i,
      status: isWeekend ? "weekend" : "work",
      hours: isWeekend ? 0 : 8,
    });
  }
  return days;
};

// Применяем отсутствие (отпуска и больничные)
const applyAbsences = (baseDays: DayData[]) => {
  const e1Days = baseDays.map((d) =>
    d.day >= 7 && d.day <= 14 ? { ...d, status: "vacation" as Status, hours: 0 } : d
  );
  const e2Days = baseDays.map((d) =>
    d.day >= 15 && d.day <= 18 ? { ...d, status: "sick" as Status, hours: 0 } : d
  );
  const e3Days = [...baseDays];

  return [
    { ...EMPLOYEES[0], days: e1Days },
    { ...EMPLOYEES[1], days: e2Days },
    { ...EMPLOYEES[2], days: e3Days },
  ];
};

const MONTH_DATA = applyAbsences(generateMonth());

const fmtMoney = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

const getCode = (status: Status) => {
  if (status === "work") return "Я";
  if (status === "vacation") return "ОТ";
  if (status === "sick") return "Б";
  return "";
};

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function TimesheetDemo({ onInteract }: Props) {
  const [view, setView] = useState<"hours" | "marks">("hours");
  const [downloaded, setDownloaded] = useState(false);

  const interact = () => onInteract?.();

  const handleDownload = () => {
    setDownloaded(true);
    interact();
    setTimeout(() => setDownloaded(false), 3000);
  };

  // Считаем итоги
  const totalHoursAll = MONTH_DATA.reduce(
    (sum, emp) => sum + emp.days.reduce((s, d) => s + d.hours, 0),
    0
  );
  const totalPayAll = MONTH_DATA.reduce(
    (sum, emp) =>
      sum +
      emp.days.reduce((s, d) => s + d.hours, 0) * emp.rate,
    0
  );

  return (
    <div className="bg-white rounded-xl">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Табель за сентябрь 2026
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Автоматический расчёт часов и зарплаты
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Переключатель вида */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => {
                setView("hours");
                interact();
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "hours"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Часы
            </button>
            <button
              onClick={() => {
                setView("marks");
                interact();
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "marks"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Явки (Я/ОТ/Б)
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-xs font-medium transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать Excel
          </button>
        </div>
      </div>

      {/* Уведомление о скачивании */}
      {downloaded && (
        <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Файл «Табель_Сентябрь_2026.xlsx» сформирован (демо)
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="sticky left-0 bg-slate-50 z-20 px-3 py-2 text-left font-semibold border-r border-slate-200 w-[160px] sm:w-[200px]">
                Сотрудник
              </th>
              {MONTH_DATA[0].days.map((d) => {
                const dow = new Date(2026, 8, d.day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <th
                    key={d.day}
                    className={`px-0.5 sm:px-1 py-2 font-medium w-7 sm:w-8 border-r border-slate-100 last:border-0 ${
                      isWeekend ? "bg-rose-50/50 text-rose-500" : ""
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-wider mb-0.5 opacity-70">
                      {WEEKDAYS[dow]}
                    </div>
                    <div>{d.day}</div>
                  </th>
                );
              })}
              <th className="px-2 sm:px-3 py-2 font-bold border-l border-slate-200 text-slate-700 w-14 sm:w-16">
                Часы
              </th>
              <th className="px-2 sm:px-3 py-2 font-bold text-slate-700 w-20 sm:w-24">
                К выплате
              </th>
            </tr>
          </thead>
          <tbody>
            {MONTH_DATA.map((emp) => {
              const totalHours = emp.days.reduce((s, d) => s + d.hours, 0);
              const totalPay = totalHours * emp.rate;

              return (
                <tr
                  key={emp.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Сотрудник */}
                  <td className="sticky left-0 bg-white px-3 py-2 text-left border-r border-slate-200 z-10">
                    <div className="font-medium text-slate-900 text-[11px] sm:text-xs truncate">
                      {emp.name}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 truncate">
                      {emp.position}
                    </div>
                  </td>

                  {/* Дни */}
                  {emp.days.map((d) => {
                    const dow = new Date(2026, 8, d.day).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isVacation = d.status === "vacation";
                    const isSick = d.status === "sick";

                    return (
                      <td
                        key={d.day}
                        className={`px-0.5 sm:px-1 py-2 border-r border-slate-100 text-[10px] sm:text-[11px] font-medium ${
                          isWeekend
                            ? "bg-rose-50/30 text-slate-300"
                            : isVacation
                            ? "bg-amber-100 text-amber-800"
                            : isSick
                            ? "bg-blue-100 text-blue-800"
                            : "text-slate-700"
                        }`}
                      >
                        {view === "hours"
                          ? d.hours > 0
                            ? d.hours
                            : ""
                          : getCode(d.status)}
                      </td>
                    );
                  })}

                  {/* Итоги */}
                  <td className="px-2 sm:px-3 py-2 border-l border-slate-200 font-bold text-slate-800 bg-slate-50/50">
                    {totalHours}
                  </td>
                  <td className="px-2 sm:px-3 py-2 font-bold text-emerald-600 bg-slate-50/50 whitespace-nowrap">
                    {fmtMoney(totalPay)}
                  </td>
                </tr>
              );
            })}

            {/* Итоговая строка */}
            <tr className="bg-slate-100 font-bold">
              <td className="sticky left-0 bg-slate-100 px-3 py-2 text-left border-r border-slate-200 z-10 text-slate-900">
                ИТОГО
              </td>
              <td
                colSpan={MONTH_DATA[0].days.length}
                className="px-2 py-2 text-slate-500 font-normal border-r border-slate-200 text-[10px] text-right pr-4"
              >
                {MONTH_DATA.length} сотрудника
              </td>
              <td className="px-2 sm:px-3 py-2 border-l border-slate-200 text-slate-900">
                {totalHoursAll}
              </td>
              <td className="px-2 sm:px-3 py-2 text-emerald-700 whitespace-nowrap">
                {fmtMoney(totalPayAll)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div className="mt-4 flex items-center gap-4 text-[10px] sm:text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />
          Отпуск
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
          Больничный
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-100" />
          Выходной
        </div>
        <div className="ml-auto text-slate-400 hidden sm:block">
          💡 Переключите «Часы / Явки» — как в бухгалтерских программах
        </div>
      </div>
    </div>
  );
}