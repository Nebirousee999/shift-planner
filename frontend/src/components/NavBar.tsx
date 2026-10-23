import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
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
  AlertCircle,
  MapPin,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import { useOrganization } from "../store/organization";
import LocationSwitcher from "./LocationSwitcher";

type TabLink = {
  path: string;
  label: string;
  icon: React.ElementType;
  hideIfTimeTrackingOff?: boolean;
};
type TabCategory = { id: string; label: string; links: TabLink[] };

const CATEGORIES: TabCategory[] = [
  {
    id: "schedule",
    label: "Расписание",
    links: [
      { path: "/weeks", label: "Недели", icon: CalendarDays },
      { path: "/locations", label: "Точки", icon: MapPin },
      { path: "/templates", label: "Шаблоны", icon: Calendar },
      {
        path: "/time",
        label: "Учёт времени",
        icon: Clock,
        hideIfTimeTrackingOff: true,
      },
      { path: "/swaps", label: "Обмены", icon: ArrowLeftRight },
    ],
  },
  {
    id: "users",
    label: "Пользователи",
    links: [
      { path: "/team", label: "Сотрудники", icon: Users },
      { path: "/vacations", label: "Отпуска", icon: Palmtree },
      { path: "/sick-leaves", label: "Больничные", icon: AlertCircle },
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

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}

function Badge({ value, tone = "red" }: { value: number; tone?: "red" | "amber" }) {
  if (value <= 0) return null;
  const cls =
    tone === "red" ? "bg-red-500 text-white" : "bg-amber-500 text-white";
  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${cls}`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { vacationsPending, swapsIncoming, shiftChangesIncoming, refresh } =
    useNotifications();
  const org = useOrganization((s) => s.org);

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const timeTrackingOn = org?.timeTrackingEnabled !== false;

  const visibleCategories = CATEGORIES.map((cat) => ({
    ...cat,
    links: cat.links.filter(
      (link) => !(link.hideIfTimeTrackingOff && !timeTrackingOn)
    ),
  }));

  const currentCategory = (() => {
    for (const cat of visibleCategories) {
      for (const link of cat.links) {
        if (pathname === link.path || pathname.startsWith(link.path + "/")) {
          return cat;
        }
      }
    }
    return null;
  })();

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

  // ─── Сотрудник ──────────────────────────────────────
  if (!isAdmin) {
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 shrink-0"
              title="Дашборд"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 hidden sm:inline">
                Планировщик
              </span>
            </button>

            <nav className="flex items-center gap-1">
              <button
                onClick={() => navigate("/")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive(pathname, "/")
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Дашборд
              </button>
              <button
                onClick={() => navigate("/my")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive(pathname, "/my")
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Мой график
              </button>
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
      </header>
    );
  }

  // ─── Админ ──────────────────────────────────────────
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/95">
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
            {visibleCategories.map((cat) => {
              const active = currentCategory?.id === cat.id;
              const firstLink = cat.links[0];
              if (!firstLink) return null;

              let badge = 0;
              if (cat.id === "users") badge = vacationsPending;
              if (cat.id === "schedule")
                badge = swapsIncoming + shiftChangesIncoming;

              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(firstLink.path)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span>{cat.label}</span>
                  <Badge value={badge} />
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

      {/* Подменю активной категории + переключатель точек.
          Вкладки и свитчер — ДВА разных контейнера:
          overflow-x-auto только на вкладках, чтобы не обрезать dropdown. */}
      {currentCategory && currentCategory.links.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-stretch gap-3">
            {/* Вкладки — скроллятся при переполнении */}
            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
              {currentCategory.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.path);

                let badge = 0;
                if (link.path === "/vacations") badge = vacationsPending;
                if (link.path === "/swaps") badge = swapsIncoming;
                if (link.path === "/weeks") badge = shiftChangesIncoming;

                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? "border-brand-600 text-brand-700 font-medium"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                    <Badge value={badge} />
                  </button>
                );
              })}
            </div>

            {/* Свитчер — ВНЕ overflow-x-auto, чтобы dropdown не обрезался */}
            {currentCategory.id === "schedule" && (
              <div className="flex items-center shrink-0 py-1.5">
                <LocationSwitcher />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}