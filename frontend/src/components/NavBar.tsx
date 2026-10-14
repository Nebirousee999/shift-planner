import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  CalendarDays,
  Clock,
  FileText,
  ArrowLeftRight,
  UserCircle,
  LogOut,
  Palmtree,
  FileSpreadsheet,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";

// ─── Структура вкладок ──────────────────────────────
type TabLink = { path: string; label: string; icon: React.ElementType };
type TabCategory = { id: string; label: string; links: TabLink[] };

const CATEGORIES: TabCategory[] = [
  {
    id: "schedule",
    label: "Расписание",
    links: [
      { path: "/weeks", label: "Недели", icon: CalendarDays },
      { path: "/templates", label: "Шаблоны", icon: Calendar },
      { path: "/time", label: "Учёт времени", icon: Clock },
      { path: "/swaps", label: "Обмены", icon: ArrowLeftRight },
    ],
  },
  {
    id: "users",
    label: "Пользователи",
    links: [
      { path: "/team", label: "Сотрудники", icon: Users },
      { path: "/vacations", label: "Отпуска", icon: Palmtree },
    ],
  },
  {
    id: "analytics",
    label: "Аналитика",
    links: [{ path: "/analytics", label: "Статистика", icon: BarChart3 }],
  },
  {
    id: "documents",
    label: "Документация",
    links: [
      { path: "/timesheet", label: "Табель", icon: FileSpreadsheet },
      { path: "/documents", label: "Документы", icon: FileText },
    ],
  },
];

function getCategoryByPath(pathname: string): TabCategory | null {
  for (const cat of CATEGORIES) {
    for (const link of cat.links) {
      if (pathname === link.path || pathname.startsWith(link.path + "/")) {
        return cat;
      }
    }
  }
  return null;
}

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { vacationsPending, swapsIncoming, refresh } = useNotifications();

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const currentCategory = getCategoryByPath(pathname);

  // ─── Обновление счётчиков каждые 30 секунд ────────
  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin, refresh]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Для сотрудника — упрощённое меню
  if (!isAdmin) {
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate("/my")}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 hidden sm:inline">
              Планировщик
            </span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/help")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/help")
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Справка"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden lg:inline">Справка</span>
            </button>
            <button
              onClick={() => navigate("/profile")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/profile")
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Профиль"
            >
              <UserCircle className="w-4 h-4" />
              <span className="hidden lg:inline">
                {user?.name ?? user?.email}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Для владельца/менеджера — полное меню с категориями
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/95">
      {/* Верхняя строка: логотип + категории + профиль/справка/выход */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0"
            title="На главную"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 hidden sm:inline">
              Планировщик
            </span>
          </button>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => {
              const active = currentCategory?.id === cat.id;
              const firstLink = cat.links[0];

              // Бейдж на категорию
              let badge = 0;
              if (cat.id === "users") badge = vacationsPending;
              if (cat.id === "schedule") badge = swapsIncoming;

              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(firstLink.path)}
                  className={`relative px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {cat.label}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate("/help")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isActive(pathname, "/help")
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Справка"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden lg:inline">Справка</span>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isActive(pathname, "/profile")
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Профиль"
          >
            <UserCircle className="w-4 h-4" />
            <span className="hidden lg:inline">
              {user?.name ?? user?.email}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Нижняя строка: подменю активной категории */}
      {currentCategory && currentCategory.links.length > 1 && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {currentCategory.links.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.path);

              // Бейдж на конкретный пункт
              let badge = 0;
              if (link.path === "/vacations") badge = vacationsPending;
              if (link.path === "/swaps") badge = swapsIncoming;

              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`relative flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? "border-brand-600 text-brand-700 font-medium"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                  {badge > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Если категория одна — подменю всё равно показываем */}
      {currentCategory && currentCategory.links.length === 1 && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1">
            {currentCategory.links.map((link) => {
              const Icon = link.icon;
              return (
                <div
                  key={link.path}
                  className="flex items-center gap-2 px-3 py-2 text-sm border-b-2 border-brand-600 text-brand-700 font-medium"
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}