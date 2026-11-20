import { ArrowRight, Check } from "lucide-react";

type Props = {
  onCtaClick?: () => void;
};

export default function FinalCTA({ onCtaClick }: Props) {
  return (
    <section className="relative overflow-hidden bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="relative bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 rounded-3xl overflow-hidden px-6 py-16 sm:px-16 sm:py-20 text-center shadow-2xl">
          {/* Декоративные круги */}
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03] pointer-events-none" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Готовы навести порядок в сменах?
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Зарегистрируйтесь — настроите команду и график за 10 минут.
              Первые 3 сотрудника бесплатно.
            </p>

            <button
              onClick={onCtaClick}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-700 rounded-xl hover:bg-slate-100 text-base font-semibold shadow-lg transition-all"
            >
              Начать бесплатно
              <ArrowRight className="w-4 h-4" />
            </button>

            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80 mt-6">
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-300" />
                Без карты
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-300" />
                Отмена в один клик
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-300" />
                Настройка за 10 минут
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}