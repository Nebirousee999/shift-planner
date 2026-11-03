import { CalendarDays, Mail, Send } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";

const COLUMNS = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "#features" },
      { label: "Тарифы", href: "#pricing" },
      { label: "Вопросы", href: "#faq" },
      { label: "Как работает", href: "#how" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О нас", href: "/about" },
      { label: "Контакты", href: "/contacts" },
    ],
  },
  {
    title: "Документы",
    links: [
      { label: "Политика конфиденциальности", href: "/privacy" },
      { label: "Пользовательское соглашение", href: "/terms" },
      { label: "Оферта", href: "/offer" },
    ],
  },
];

export default function LandingFooter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const scrollTo = (href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      const isHomePage = pathname === "/" || pathname === "/welcome";
      if (isHomePage) {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/", { state: { scrollTo: href } });
      }
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">Планировщик</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Смены, отпуска и документы для небольших команд.
            </p>
            <div className="flex gap-2">
              <a
                href="mailto:help@shift-planner.ru"
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a
                href="https://t.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                aria-label="Telegram"
              >
                <Send className="w-4 h-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-slate-900 text-sm mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("#") ? (
                      <a
                        href={l.href}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollTo(l.href);
                        }}
                        className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.href}
                        className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Планировщик смен · Все права защищены
          </div>
          <div>Сделано с ❤️ для малого бизнеса</div>
        </div>
      </div>
    </footer>
  );
}