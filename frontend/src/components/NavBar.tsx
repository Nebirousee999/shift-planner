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

type Link = { path: string; label: string; icon: React.ElementType };

const ADMIN_LINKS: Link[] = [
  { path: "/", label: "Дашборд", icon: LayoutDashboard },
  { path: "/analytics", label: "Аналитика", icon: BarChart3 },
  { path: "/weeks", label: "Недели", icon: CalendarDays },
  { path: "/templates", label: "Шаблоны", icon: Calendar },
  { path: "/team", label: "Сотрудники", icon: Users },
  { path: "/time", label: "Учёт времени", icon: Clock },
  { path: "/vacations", label: "Отпуска", icon: Palmtree },
  { path: "/swaps", label: "Обмены", icon: ArrowLeftRight },
  { path: "/timesheet", label: "Табель", icon: FileSpreadsheet },
  { path: "/documents", label: "Документы", icon: FileText },
  { path: "/help", label: "Справка", icon: HelpCircle },
];

const EMPLOYEE_LINKS: Link[] = [
  { path: "/my", label: "Мой график", icon: CalendarDays },
  { path: "/help", label: "Справка", icon: HelpCircle },
];

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const links = isAdmin ? ADMIN_LINKS : EMPLOYEE_LINKS;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Логотип + навигация */}
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={() => navigate(isAdmin ? "/" : "/my")}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 hidden sm:inline">
              Планировщик
            </span>
          </button>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((l) => {
              const Icon = l.icon;
              const active = isActive(l.path);
              return (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{l.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Профиль */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isActive("/profile")
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