import { UserPlus, Users, CalendarCheck } from "lucide-react";

const STEPS = [
  {
    n: 1,
    icon: UserPlus,
    title: "Регистрация",
    time: "30 секунд",
    text: "Укажите email и название заведения. Без карты и подтверждений.",
  },
  {
    n: 2,
    icon: Users,
    title: "Добавьте команду",
    time: "2 минуты",
    text: "Вручную или импорт из Excel — сразу со ставками и должностями.",
  },
  {
    n: 3,
    icon: CalendarCheck,
    title: "Планируйте неделю",
    time: "5 минут",
    text: "Перетаскивайте смены и публикуйте одной кнопкой. Всё.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-24 scroll-mt-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Работает за 3 шага
          </h2>
          <p className="text-lg text-slate-600">
            От регистрации до готового графика — 10 минут
          </p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* Линия-связка (desktop) */}
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 -z-0" />

          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="relative bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center shadow-sm"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/30 mb-5 relative">
                  <Icon className="w-7 h-7 text-white" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-brand-700 text-sm font-bold flex items-center justify-center shadow border border-brand-100">
                    {s.n}
                  </span>
                </div>
                <div className="text-[11px] uppercase tracking-wide text-brand-600 font-semibold mb-1">
                  ~ {s.time}
                </div>
                <h3 className="font-semibold text-slate-900 text-lg mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}