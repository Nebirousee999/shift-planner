import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

type Props = {
  id: string;
  eyebrow: string;
  icon: React.ElementType;
  title: string;
  description: string;
  bullets: string[];
  demo: React.ReactNode;
  variant?: "light" | "tinted"; // <-- НОВОЕ
};

export default function FeatureSection({
  id,
  eyebrow,
  icon: Icon,
  title,
  description,
  bullets,
  demo,
  variant = "light",
}: Props) {
  const navigate = useNavigate();
  const isTinted = variant === "tinted";

  return (
    <section
      id={id}
      className={`py-16 sm:py-24 border-t border-slate-200/60 scroll-mt-20 ${
        isTinted ? "bg-slate-50" : "bg-white"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Шапка секции */}
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full mb-4 ${
              isTinted
                ? "bg-white text-brand-700 border border-slate-200"
                : "bg-brand-50 text-brand-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {eyebrow}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            {title}
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            {description}
          </p>

          <ul className="grid sm:grid-cols-3 gap-3 sm:gap-4 text-left max-w-2xl mx-auto">
            {bullets.map((b) => (
              <li
                key={b}
                className={`flex items-start gap-2 text-sm text-slate-700 rounded-lg p-3 sm:p-0 ${
                  isTinted ? "bg-white sm:bg-transparent" : "bg-slate-50 sm:bg-transparent"
                }`}
              >
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Демо — контрастирует с фоном секции */}
        <div
          className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-6 lg:p-8 shadow-sm ${
            isTinted
              ? "bg-white border-slate-200"
              : "bg-slate-50 border-slate-200/80"
          }`}
        >
          {demo}
        </div>

        {/* CTA */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate("/login?mode=register")}
            className={`inline-flex items-center gap-2 px-5 py-2.5 border font-semibold rounded-xl transition-colors shadow-sm ${
              isTinted
                ? "bg-white border-slate-200 text-brand-600 hover:border-brand-300 hover:bg-brand-50"
                : "bg-white border-slate-200 text-brand-600 hover:border-brand-300 hover:bg-brand-50"
            }`}
          >
            Попробовать в своём аккаунте
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}