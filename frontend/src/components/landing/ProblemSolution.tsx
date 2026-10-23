import { Check, X, ArrowRight, ArrowDown } from "lucide-react";

const PROBLEMS = [
  "Excel-таблицы с формулами, которые ломаются",
  "Звонки и сообщения «кто сегодня работает?»",
  "Отпуска в мессенджерах — не найти концы",
  "Приказы по ТК вручную в Word — ошибки",
];

const SOLUTIONS = [
  "Drag-and-drop смены, проверка ТК РФ",
  "Все видят актуальный график в телефоне",
  "Гант-календарь с согласованием",
  "Документы по ТК — за 30 секунд",
];

export default function ProblemSolution() {
  return (
    <section className="relative py-20 sm:py-28 bg-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Знакомо?
          </h2>
          <p className="text-lg text-slate-500">
            Планирование смен в Excel — это больно. Мы знаем.
          </p>
        </div>

        <div className="relative grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-stretch">
          {/* ─── ЛЕВАЯ КАРТОЧКА (ПРОБЛЕМА) ─── */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 relative overflow-hidden shadow-sm">
            {/* Водяной знак на фоне */}
            <div className="absolute -bottom-10 -right-10 text-slate-50 pointer-events-none transform -rotate-12">
              <X className="w-64 h-64 opacity-100" strokeWidth={1} />
            </div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wide rounded-full mb-8">
                <X className="w-4 h-4 text-rose-500" />
                Без Планировщика
              </div>
              <ul className="space-y-5">
                {PROBLEMS.map((p) => (
                  <li key={p} className="flex items-start gap-3.5 text-slate-600">
                    <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <span className="text-[15px] leading-snug font-medium">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ─── СТРЕЛКА (ДЕСКТОП) ─── */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-400 relative z-20">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* ─── СТРЕЛКА (МОБИЛЬНЫЕ) ─── */}
          <div className="flex lg:hidden items-center justify-center py-2">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400">
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>

          {/* ─── ПРАВАЯ КАРТОЧКА (РЕШЕНИЕ) — ЯРКАЯ ─── */}
          <div className="bg-gradient-to-br from-blue-600 via-brand-600 to-indigo-700 rounded-3xl p-8 sm:p-10 relative overflow-hidden shadow-2xl shadow-brand-500/30 ring-1 ring-white/20">
            {/* Декоративное свечение (стало более светлым и ярким) */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-300/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 border border-white/30 text-white text-xs font-bold uppercase tracking-wide rounded-full mb-8 shadow-sm backdrop-blur-md">
                <Check className="w-4 h-4 text-emerald-300" />
                С Планировщиком
              </div>
              <ul className="space-y-5">
                {SOLUTIONS.map((s) => (
                  <li key={s} className="flex items-start gap-3.5 text-white">
                    {/* ЯРКИЕ ГАЛКИ: сочный зеленый фон и белая иконка со свечением */}
                    <div className="w-6 h-6 rounded-full bg-emerald-400 text-white shadow-[0_0_12px_rgba(52,211,153,0.6)] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </div>
                    <span className="text-[15px] leading-snug font-medium tracking-wide">
                      {s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}