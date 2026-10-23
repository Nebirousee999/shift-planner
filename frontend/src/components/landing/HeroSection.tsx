import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { trackEvent } from "../../lib/metrika";

// ─── A/B Варианты текстов ───
const TITLES = {
  a: (
    <>
      Смены, отпуска и документы{" "}
      <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
        в одном окне
      </span>
    </>
  ),
  b: (
    <>
      График смен за 5 минут{" "}
      <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
        вместо 2 часов в Excel
      </span>
    </>
  ),
  c: (
    <>
      Планировщик для команды,{" "}
      <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
        которая устала от Excel
      </span>
    </>
  ),
};

const SUBTITLES = {
  a: "Перестаньте собирать расписание в Excel. Планируйте смены за 5 минут, согласовывайте отпуска и генерируйте приказы по ТК.",
  b: "Создавайте график в пару кликов. Сотрудники видят смены в телефоне, а приказы по ТК генерируются автоматически.",
  c: "Скажите «нет» звонкам и мессенджерам. Все смены, отпуска и документы — в одном простом интерфейсе.",
};

// ─── Превью (тот самый потерянный компонент) ───
const MiniSchedulePreview = () => {
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const dates = [20, 21, 22, 23, 24, 25, 26];

  const colors = { a: "#3b82f6", b: "#8b5cf6", c: "#10b981", d: "#f59e0b" };
  const shifts: Record<number, { color: string; start: number; end: number }[]> = {
    0: [{ color: colors.a, start: 9, end: 15 }, { color: colors.b, start: 12, end: 20 }],
    1: [{ color: colors.a, start: 9, end: 15 }],
    2: [{ color: colors.c, start: 14, end: 22 }],
    3: [{ color: colors.b, start: 12, end: 20 }],
    4: [{ color: colors.a, start: 10, end: 18 }, { color: colors.c, start: 14, end: 22 }],
    5: [{ color: colors.b, start: 10, end: 18 }, { color: colors.d, start: 12, end: 18 }],
    6: [{ color: colors.a, start: 12, end: 18 }],
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Подложка-«тень» */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-violet-500/20 rounded-3xl blur-2xl transform translate-y-4 scale-95" />

      {/* Карточка */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Топ-бар */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xs font-medium text-slate-600">Октябрь 2026</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-medium">
            Опубликован
          </span>
        </div>

        {/* Сетка */}
        <div className="grid grid-cols-7 gap-1 p-2">
          {weekdays.map((d, i) => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase py-1">
              {d}
            </div>
          ))}
          {dates.map((day, i) => {
            const dayShifts = shifts[i] ?? [];
            return (
              <div
                key={day}
                className="relative min-h-[70px] bg-slate-50/60 rounded-md p-1 space-y-0.5"
              >
                <div className="text-[10px] font-bold text-slate-700 text-center">{day}</div>
                {dayShifts.map((s, j) => {
                  const leftPct = (s.start / 24) * 100;
                  const widthPct = ((s.end - s.start) / 24) * 100;
                  return (
                    <div key={j} className="relative h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="absolute inset-y-0 rounded-sm"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Футер карточки */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-800">12 смен</span> · 96 часов
          </div>
          <div className="text-[11px] font-semibold text-emerald-600">38 400 ₽</div>
        </div>
      </div>
    </div>
  );
};

// ─── Основной компонент ───
type Props = {
  onCtaClick?: () => void;
};

export default function HeroSection({ onCtaClick }: Props) {
  const [searchParams] = useSearchParams();
  const variantParam = searchParams.get("variant") || "a";
  const variant = (["a", "b", "c"].includes(variantParam) ? variantParam : "a") as "a" | "b" | "c";

  useEffect(() => {
    trackEvent("Hero_view", { variant });
  }, [variant]);

  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      {/* Фоновые декоративные круги */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-100/60 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Текстовая часть */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-brand-200 text-brand-700 text-xs font-medium rounded-full mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Для кафе, салонов и магазинов
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
              {TITLES[variant]}
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              {SUBTITLES[variant]}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-6">
              <button
                onClick={onCtaClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-base font-semibold shadow-lg shadow-brand-500/20 hover:shadow-xl transition-all"
              >
                Начать бесплатно
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#dashboard-demo"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-slate-700 hover:bg-slate-100 rounded-xl text-base font-medium transition-colors"
              >
                Посмотреть демо ↓
              </a>
            </div>

            <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-slate-500">
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Без карты
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Первые 3 сотрудника бесплатно
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Отмена в один клик
              </li>
            </ul>
          </div>

          {/* Превью справа */}
          <div className="relative">
            <MiniSchedulePreview />
          </div>
        </div>
      </div>
    </section>
  );
}