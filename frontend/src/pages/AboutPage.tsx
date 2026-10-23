import { Link } from "react-router-dom";
import {
  CalendarDays,
  Heart,
  Zap,
  ShieldCheck,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import LandingHeader from "../components/landing/LandingHeader";
import LandingFooter from "../components/landing/LandingFooter";

export default function AboutPage() {
  const principles = [
    {
      icon: Zap,
      title: "Простота",
      desc: "Никаких 100-страничных инструкций. Если интерфейс нужно объяснять дольше 5 минут — мы переделываем интерфейс.",
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      icon: Heart,
      title: "Забота",
      desc: "Мы создаем продукт для людей. Вы должны закрывать график и идти домой к семье, а не сидеть в Excel до ночи.",
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
    {
      icon: ShieldCheck,
      title: "Надежность",
      desc: "Данные ваших сотрудников и графики всегда в безопасности. Ежедневные бэкапы и защищенные серверы.",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingHeader />

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28">
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-50 blur-3xl" />
            <div className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full bg-violet-50 blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-brand-200 text-brand-700 text-sm font-medium rounded-full mb-8 shadow-sm">
              <Sparkles className="w-4 h-4" />
              О компании
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
              Мы делаем смены <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">
                по-настоящему простыми
              </span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Планировщик смен — это не просто софт для управления персоналом. Это инструмент, который возвращает вам ваши выходные.
            </p>
          </div>
        </section>

        {/* ─── МИССИЯ ─── */}
        <section className="py-16 sm:py-24 bg-slate-50 border-y border-slate-200/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                  Почему мы это создали?
                </h2>
                <div className="space-y-4 text-lg text-slate-600 leading-relaxed">
                  <p>
                    Мы сами долгое время работали в сфере услуг. Мы знаем, каково это — 
                    в воскресенье вечером собирать график в Excel, а потом полночи обзванивать 
                    сотрудников, потому что кто-то заболел.
                  </p>
                  <p>
                    Мы устали от сложных ERP-систем, в которых нужно полгода учиться только 
                    для того, чтобы поставить галочку в табеле. Так появился «Планировщик смен».
                  </p>
                  <p className="font-medium text-slate-900">
                    Наша цель — сделать управление командой таким же простым, как заказать кофе.
                  </p>
                </div>
              </div>
              
              {/* Декоративная карточка */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 to-violet-500/10 rounded-3xl transform rotate-3 scale-105" />
                <div className="relative bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
                  <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-6">
                    <Users className="w-8 h-8 text-brand-600" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <span className="text-slate-500">Часов в Excel</span>
                      <span className="font-bold text-rose-500 line-through">~ 4 часа/нед</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <span className="text-slate-500">Часов в Планировщике</span>
                      <span className="font-bold text-emerald-600">~ 10 минут/нед</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Сэкономлено нервов</span>
                      <span className="font-bold text-brand-600">100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ПРИНЦИПЫ ─── */}
        <section className="py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Наши принципы
              </h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                Три вещи, на которых держится наш продукт и наша команда.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {principles.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className={`w-14 h-14 rounded-2xl ${p.bg} ${p.color} flex items-center justify-center mb-6`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{p.title}</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── ЦИФРЫ ─── */}
        <section className="py-16 bg-brand-600">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
              <div>
                <div className="text-4xl sm:text-5xl font-black mb-2">500+</div>
                <div className="text-brand-100 text-sm font-medium">Команд пользуются</div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-black mb-2">12к</div>
                <div className="text-brand-100 text-sm font-medium">Смен создано</div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-black mb-2">99.9%</div>
                <div className="text-brand-100 text-sm font-medium">Uptime серверов</div>
              </div>
              <div>
                <div className="text-4xl sm:text-5xl font-black mb-2">4.9</div>
                <div className="text-brand-100 text-sm font-medium">Оценка клиентов</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-24 text-center px-4">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Готовы попробовать?
          </h2>
          <Link
            to="/login?mode=register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-base font-semibold shadow-lg transition-all"
          >
            Создать аккаунт
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}