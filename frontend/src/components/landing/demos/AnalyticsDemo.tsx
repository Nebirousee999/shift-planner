import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Clock,
  Banknote,
} from "lucide-react";

// ─── Seed data для 3 месяцев ────────────────────────
type MonthData = {
  id: string;
  label: string;
  short: string;
  hours: number;
  shifts: number;
  payroll: number;
  actualPayroll: number;
  avgCost: number;
  overtimeCost: number;
  mom: {
    hours: number | null;
    payroll: number | null;
    avgCost: number | null;
    actualPayroll: number | null;
  };
  pie: { name: string; payroll: number; color: string }[];
  weekdays: { label: string; shifts: number; hours: number; payroll: number }[];
  positions: { name: string; payroll: number; percent: number; shifts: number; hours: number }[];
};

const MONTHS: MonthData[] = [
  {
    id: "sep",
    label: "Сентябрь",
    short: "Сен",
    hours: 720,
    shifts: 94,
    payroll: 288000,
    actualPayroll: 275400,
    avgCost: 3064,
    overtimeCost: 8400,
    mom: {
      hours: null,
      payroll: null,
      avgCost: null,
      actualPayroll: null,
    },
    pie: [
      { name: "Мария Иванова", payroll: 108000, color: "#3b82f6" },
      { name: "Иван Петров", payroll: 90000, color: "#8b5cf6" },
      { name: "Анна Сидорова", payroll: 62000, color: "#10b981" },
      { name: "Остальные", payroll: 28000, color: "#94a3b8" },
    ],
    weekdays: [
      { label: "Пн", shifts: 12, hours: 90, payroll: 36000 },
      { label: "Вт", shifts: 10, hours: 78, payroll: 31200 },
      { label: "Ср", shifts: 13, hours: 98, payroll: 39200 },
      { label: "Чт", shifts: 14, hours: 104, payroll: 41600 },
      { label: "Пт", shifts: 18, hours: 138, payroll: 55200 },
      { label: "Сб", shifts: 16, hours: 128, payroll: 51200 },
      { label: "Вс", shifts: 11, hours: 84, payroll: 33600 },
    ],
    positions: [
      { name: "Продавцы", payroll: 128000, percent: 44, shifts: 42, hours: 320 },
      { name: "Повара", payroll: 92000, percent: 32, shifts: 30, hours: 230 },
      { name: "Официанты", payroll: 44000, percent: 15, shifts: 14, hours: 110 },
      { name: "Бариста", payroll: 24000, percent: 9, shifts: 8, hours: 60 },
    ],
  },
  {
    id: "oct",
    label: "Октябрь",
    short: "Окт",
    hours: 810,
    shifts: 108,
    payroll: 342000,
    actualPayroll: 336400,
    avgCost: 3167,
    overtimeCost: 12800,
    mom: {
      hours: 12.5,
      payroll: 18.8,
      avgCost: 3.4,
      actualPayroll: 22.1,
    },
    pie: [
      { name: "Мария Иванова", payroll: 132000, color: "#3b82f6" },
      { name: "Иван Петров", payroll: 108000, color: "#8b5cf6" },
      { name: "Анна Сидорова", payroll: 74000, color: "#10b981" },
      { name: "Остальные", payroll: 28000, color: "#94a3b8" },
    ],
    weekdays: [
      { label: "Пн", shifts: 14, hours: 105, payroll: 44100 },
      { label: "Вт", shifts: 11, hours: 82, payroll: 34400 },
      { label: "Ср", shifts: 15, hours: 112, payroll: 47000 },
      { label: "Чт", shifts: 16, hours: 120, payroll: 50400 },
      { label: "Пт", shifts: 22, hours: 168, payroll: 70500 },
      { label: "Сб", shifts: 19, hours: 148, payroll: 62100 },
      { label: "Вс", shifts: 11, hours: 75, payroll: 33500 },
    ],
    positions: [
      { name: "Продавцы", payroll: 150000, percent: 44, shifts: 48, hours: 360 },
      { name: "Повара", payroll: 110000, percent: 32, shifts: 36, hours: 270 },
      { name: "Официанты", payroll: 54000, percent: 16, shifts: 16, hours: 120 },
      { name: "Бариста", payroll: 28000, percent: 8, shifts: 8, hours: 60 },
    ],
  },
  {
    id: "nov",
    label: "Ноябрь",
    short: "Ноя",
    hours: 690,
    shifts: 88,
    payroll: 298000,
    actualPayroll: 281600,
    avgCost: 3386,
    overtimeCost: 6200,
    mom: {
      hours: -14.8,
      payroll: -12.9,
      avgCost: 6.9,
      actualPayroll: -16.3,
    },
    pie: [
      { name: "Мария Иванова", payroll: 112000, color: "#3b82f6" },
      { name: "Иван Петров", payroll: 96000, color: "#8b5cf6" },
      { name: "Анна Сидорова", payroll: 66000, color: "#10b981" },
      { name: "Остальные", payroll: 24000, color: "#94a3b8" },
    ],
    weekdays: [
      { label: "Пн", shifts: 11, hours: 82, payroll: 35400 },
      { label: "Вт", shifts: 9, hours: 68, payroll: 29400 },
      { label: "Ср", shifts: 12, hours: 90, payroll: 38900 },
      { label: "Чт", shifts: 14, hours: 105, payroll: 45400 },
      { label: "Пт", shifts: 18, hours: 138, payroll: 59600 },
      { label: "Сб", shifts: 16, hours: 122, payroll: 52700 },
      { label: "Вс", shifts: 8, hours: 60, payroll: 26000 },
    ],
    positions: [
      { name: "Продавцы", payroll: 128000, percent: 43, shifts: 40, hours: 305 },
      { name: "Повара", payroll: 96000, percent: 32, shifts: 30, hours: 225 },
      { name: "Официанты", payroll: 48000, percent: 16, shifts: 12, hours: 100 },
      { name: "Бариста", payroll: 26000, percent: 9, shifts: 6, hours: 60 },
    ],
  },
];

// ─── Утилиты ───────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5">
        <Minus className="w-3 h-3" />
        —
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5">
        <Minus className="w-3 h-3" />0%
      </span>
    );
  }
  const isUp = value > 0;
  return (
    <span
      className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${
        isUp ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isUp ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function AnalyticsDemo({ onInteract }: Props) {
  const [monthIndex, setMonthIndex] = useState(1); // октябрь
  const data = MONTHS[monthIndex];

  const interact = () => onInteract?.();

  const changeMonth = (i: number) => {
    if (i === monthIndex) return;
    setMonthIndex(i);
    interact();
  };

  const prevMonth = () => {
    if (monthIndex === 0) return;
    changeMonth(monthIndex - 1);
  };
  const nextMonth = () => {
    if (monthIndex === MONTHS.length - 1) return;
    changeMonth(monthIndex + 1);
  };

  const totalPie = data.pie.reduce((s, p) => s + p.payroll, 0);
  let pieAccum = 0;
  const pieGradient = data.pie
    .map((p) => {
      const start = pieAccum;
      pieAccum += (p.payroll / totalPie) * 100;
      return `${p.color} ${start}% ${pieAccum}%`;
    })
    .join(", ");

  const maxWeekdayShifts = Math.max(...data.weekdays.map((w) => w.shifts), 1);
  const maxWeekdayPayroll = Math.max(...data.weekdays.map((w) => w.payroll), 1);

  return (
    <div className="bg-white rounded-xl">
      {/* Шапка с переключателем месяцев */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            Аналитика · {data.label} 2026
          </div>
          <div className="text-sm text-slate-500 mt-1">
            ФОТ · переработки · нагрузка по дням
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            disabled={monthIndex === 0}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {MONTHS.map((m, i) => (
              <button
                key={m.id}
                onClick={() => changeMonth(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  i === monthIndex
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m.short}
              </button>
            ))}
          </div>

          <button
            onClick={nextMonth}
            disabled={monthIndex === MONTHS.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 метрики с MoM */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard
          icon={Clock}
          iconBg="bg-blue-50 text-blue-600"
          label="План часов"
          value={`${data.hours} ч`}
          hint={`${data.shifts} смен`}
          delta={data.mom.hours}
        />
        <MetricCard
          icon={Wallet}
          iconBg="bg-violet-50 text-violet-600"
          label="План ФОТ"
          value={fmtMoney(data.payroll)}
          delta={data.mom.payroll}
        />
        <MetricCard
          icon={Banknote}
          iconBg="bg-indigo-50 text-indigo-600"
          label="Средняя цена смены"
          value={fmtMoney(data.avgCost)}
          delta={data.mom.avgCost}
        />
        <MetricCard
          icon={Banknote}
          iconBg="bg-emerald-50 text-emerald-600"
          label="Факт ФОТ"
          value={fmtMoney(data.actualPayroll)}
          delta={data.mom.actualPayroll}
          highlight
        />
      </div>

      {/* Пирог + Дни недели */}
      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {/* Пирог */}
        <div className="lg:col-span-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-sm font-semibold text-slate-900 mb-3">
            Структура ФОТ
          </div>
          <div className="flex items-center justify-center mb-4">
            <div
              className="relative w-32 h-32 rounded-full transition-all duration-500"
              style={{ background: `conic-gradient(${pieGradient})` }}
            >
              <div className="absolute inset-3 bg-slate-50 rounded-full flex items-center justify-center flex-col">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                  Всего
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {fmtMoney(totalPie)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.pie.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-slate-700 truncate">{p.name}</span>
                </div>
                <span className="font-medium text-slate-900 shrink-0 ml-2">
                  {Math.round((p.payroll / totalPie) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Дни недели */}
        <div className="lg:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <div className="text-sm font-semibold text-slate-900">
              Нагрузка по дням недели
            </div>
            <span className="text-[10px] text-slate-400 ml-auto">
              смены и ФОТ
            </span>
          </div>

          <div className="space-y-2">
            {data.weekdays.map((w, i) => {
              const shiftPct = (w.shifts / maxWeekdayShifts) * 100;
              const payrollPct = (w.payroll / maxWeekdayPayroll) * 100;
              const isWeekend = i >= 5;

              return (
                <div key={w.label} className="flex items-center gap-2.5">
                  <div
                    className={`w-7 text-xs font-bold ${
                      isWeekend ? "text-violet-600" : "text-slate-700"
                    }`}
                  >
                    {w.label}
                  </div>
                  <div className="flex-1 relative h-7">
                    <div className="absolute inset-0 bg-slate-100 rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md transition-all duration-500 ${
                          isWeekend ? "bg-violet-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${shiftPct}%` }}
                      />
                    </div>
                    <div className="absolute inset-y-0 left-2 flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className="text-white drop-shadow-sm">
                        {w.shifts} см.
                      </span>
                      <span className="text-white/85 drop-shadow-sm">
                        {w.hours} ч
                      </span>
                    </div>
                  </div>
                  <div className="w-24 text-right text-xs shrink-0">
                    <div className="text-slate-900 font-semibold tabular-nums">
                      {fmtMoney(w.payroll)}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {Math.round(payrollPct)}% от макс.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Должности */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-slate-500" />
          <div className="text-sm font-semibold text-slate-900">
            ФОТ по должностям
          </div>
          <span className="text-[10px] text-slate-400 ml-auto">
            общий бюджет · {fmtMoney(data.payroll)}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {data.positions.map((p, i) => {
            const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
            const color = colors[i % colors.length];
            return (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-slate-900 truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-xs shrink-0">
                    <span className="font-semibold text-slate-900">
                      {fmtMoney(p.payroll)}
                    </span>
                    <span className="text-slate-400 ml-1">· {p.percent}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${p.percent}%`, backgroundColor: color }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {p.shifts} смен · {p.hours} ч
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Подсказка */}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Переключайте месяцы кнопками сверху — цифры и графики плавно
            меняются
          </span>
          <span className="sm:hidden">
            💡 Нажмите Сен / Окт / Ноя для смены периода
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          MoM — изменение к предыдущему месяцу
        </div>
      </div>
    </div>
  );
}

// ─── Карточка метрики ──────────────────────────────
function MetricCard({
  icon: Icon,
  iconBg,
  label,
  value,
  hint,
  delta,
  highlight,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  value: string;
  hint?: string;
  delta: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border transition-colors ${
        highlight
          ? "bg-emerald-50 border-emerald-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-[11px] text-slate-500 font-medium leading-tight">
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <div className="text-base font-bold text-slate-900 transition-all duration-300">
          {value}
        </div>
        <DeltaBadge value={delta} />
      </div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}