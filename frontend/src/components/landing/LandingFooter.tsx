import { CalendarDays } from "lucide-react";
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
    title: "Статьи",
    links: [
      { label: "Как составить график 2/2", href: "/blog/kak-sostavit-grafik-2-2" },
      { label: "Сменный график по ТК РФ", href: "/blog/smennyj-grafik-po-tk-rf" },
      { label: "График смен в Excel", href: "/blog/grafik-smen-v-excel" },
      { label: "Заявление на смену графика", href: "/blog/zayavlenie-na-smenu-grafika" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О нас", href: "/about" },
      { label: "Контакты", href: "#support" },
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
    if (href === "#support") {
      window.dispatchEvent(new Event("open-support-chat"));
      return;
    }
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
        {/* Изменено на grid-cols-5, чтобы вместить новую колонку */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon.svg" alt="Логотип" className="w-8 h-8 object-contain" />
              <span className="font-bold text-slate-900">Планировщик</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Смены, отпуска и документы для небольших команд.
            </p>
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

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 text-center">
          <div>© {new Date().getFullYear()} Планировщик смен · Все права защищены</div>
          <div>ИП Приходько Сергей Сергеевич · ИНН 701729214964 · ОГРНИП 323470400073210</div>
          <div className="mt-1">Сделано с ❤️ для малого бизнеса</div>
        </div>
      </div>
    </footer>
  );
}
