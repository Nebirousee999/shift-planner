import {
  CalendarDays,
  Palmtree,
  BarChart3,
  FileText,
  ArrowDown,
} from "lucide-react";

const FEATURES = [
  {
    title: "Смены",
    desc: "Drag-and-drop, проверка ТК РФ, копирование дней",
    icon: CalendarDays,
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "group-hover:ring-blue-200",
  },
  {
    title: "Отпуска",
    desc: "Гант-календарь, согласование, защита от пересечений",
    icon: Palmtree,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "group-hover:ring-emerald-200",
  },
  {
    title: "Аналитика",
    desc: "ФОТ, переработки, нагрузка по дням, MoM",
    icon: BarChart3,
    color: "text-violet-600",
    bg: "bg-violet-50",
    ring: "group-hover:ring-violet-200",
  },
  {
    title: "Документы",
    desc: "40+ шаблонов по ТК, свой .docx, массовый экспорт",
    icon: FileText,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "group-hover:ring-amber-200",
  },
];

export default function FeaturesOverview() {
  return (
    <section
      id="features"
      className="relative py-20 sm:py-28 bg-slate-50 overflow-hidden"
    >
      {/* Декоративный фон */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-100/40 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Всё, что нужно <span className="text-brand-600">для команды</span>
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            От составления графика до приказов по ТК — в одном инструменте.
            Работает на телефоне, ноутбуке и планшете.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`group relative bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ring-2 ring-transparent ${f.ring}`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${f.bg} ${f.color} flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Кнопка-якорь к демо */}
        <div className="mt-16 flex justify-center">
          <a
            href="#dashboard-demo"
            className="group inline-flex flex-col items-center gap-3 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors"
          >
            <span>Попробуйте интерактивные демо ниже</span>
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:border-brand-300 group-hover:shadow-md transition-all">
              <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}