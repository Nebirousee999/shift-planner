import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Calendar, Users, CalendarDays, Clock, FileText,
  ArrowLeftRight, UserCircle, LogOut, Palmtree,
  FileSpreadsheet, BarChart3, HelpCircle, AlertCircle,
  MapPin, History,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import { useOrganization } from "../store/organization";
import LocationSwitcher from "./LocationSwitcher";
           import NotificationBell from "./NotificationBell";

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
      { path: "/time", label: "Учёт времени", icon: Clock, hideIfTimeTrackingOff: true },
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
    links: [
      { path: "/analytics", label: "Статистика", icon: BarChart3 },
      { path: "/history", label: "История действий", icon: History },
    ],
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

// 🎈 ОБНОВЛЕННЫЙ БЕЙДЖ (Красный кружок справа сверху)
function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  
  // Добавили timeOffsPending, если ты вынесешь его в стор (см. ниже)
  const { vacationsPending, swapsIncoming, shiftChangesIncoming, timeOffsPending = 0, refresh } = useNotifications();
  
  const org = useOrganization((s) => s.org);

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const timeTrackingOn = org?.timeTrackingEnabled !== false;

  const visibleCategories = CATEGORIES.map((cat) => ({
    ...cat,
    links: cat.links.filter((link) => !(link.hideIfTimeTrackingOff && !timeTrackingOn)),
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
            <button onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 hidden sm:inline">Планировщик</span>
            </button>

            <nav className="flex items-center gap-1">
              <button onClick={() => navigate("/")} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Дашборд
              </button>
              <button onClick={() => navigate("/my")} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/my") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Мой график
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <button
              onClick={() => navigate("/help")}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/help")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden lg:inline">Справка</span>
            </button>
            <button
              onClick={() => navigate("/profile")}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/profile")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <UserCircle className="w-4 h-4" />
              <span className="hidden lg:inline">{user?.name ?? user?.email}</span>
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
          <button onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 hidden sm:inline">Планировщик</span>
          </button>

          <nav className="flex items-center gap-2 overflow-x-auto pt-1">
            {visibleCategories.map((cat) => {
              const active = currentCategory?.id === cat.id;
              const firstLink = cat.links[0];
              if (!firstLink) return null;

              let badge = 0;
              if (cat.id === "users") badge = vacationsPending;
              if (cat.id === "schedule") badge = swapsIncoming + shiftChangesIncoming + timeOffsPending;

              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(firstLink.path)}
                  className={`relative inline-flex items-center px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    active ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
          <NotificationBell />
          <button onClick={() => navigate("/help")} className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
            <HelpCircle className="w-4 h-4" />
            <span className="hidden lg:inline">Справка</span>
          </button>
          <button onClick={() => navigate("/profile")} className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/profile") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
            <UserCircle className="w-4 h-4" />
            <span className="hidden lg:inline">{user?.name ?? user?.email}</span>
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Подменю активной категории */}
      {currentCategory && currentCategory.links.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-stretch gap-3">
            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 pt-1 pb-1">
              {currentCategory.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.path);

                let badge = 0;
                if (link.path === "/vacations") badge = vacationsPending;
                if (link.path === "/swaps") badge = swapsIncoming;
                if (link.path === "/weeks") badge = shiftChangesIncoming + timeOffsPending;

                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`relative inline-flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                      active ? "border-brand-600 text-brand-700 font-medium" : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                    <Badge value={badge} />
                  </button>
                );
              })}
            </div>

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