import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarDays, Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "#features", label: "Возможности" },
  { href: "#how", label: "Как работает" },
  { href: "#pricing", label: "Тарифы" },
  { href: "#faq", label: "Вопросы" },
];

export default function LandingHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation(); // <-- Добавили
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goRegister = () => {
    setMobileOpen(false);
    navigate("/login?mode=register");
  };
  const goLogin = () => {
    setMobileOpen(false);
    navigate("/login");
  };

  // Обновленная функция скролла
  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const isHomePage = pathname === "/" || pathname === "/welcome";

    if (isHomePage) {
      // Если мы на главной, просто скроллим
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Если мы на другой странице (О нас, Политика и т.д.),
      // переходим на главную и передаем нужный якорь через state
      navigate("/", { state: { scrollTo: href } });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        scrolled
          ? "bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Лого */}
        <button
          onClick={() => {
            if (pathname === "/" || pathname === "/welcome") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              navigate("/");
            }
          }}
          className="flex items-center gap-2 shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900">Планировщик</span>
        </button>

        {/* Десктоп-навигация */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => scrollTo(l.href)}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Десктоп-кнопки */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={goLogin}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Войти
          </button>
          <button
            onClick={goRegister}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors shadow-sm hover:shadow"
          >
            Попробовать бесплатно
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Мобильный бургер */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          aria-label="Меню"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Мобильное меню */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                onClick={goLogin}
                className="w-full px-3 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Войти
              </button>
              <button
                onClick={goRegister}
                className="w-full px-3 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700"
              >
                Попробовать бесплатно
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}