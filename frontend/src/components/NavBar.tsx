import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Calendar, Users, CalendarDays, Clock, FileText,
  ArrowLeftRight, UserCircle, LogOut, Palmtree,
  FileSpreadsheet, BarChart3, HelpCircle, AlertCircle, Wallet,
  MapPin, History, ListChecks, MessageSquare,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useNotifications } from "../store/notifications";
import { useOrganization } from "../store/organization";
import { supportApi } from "../api/support";
import { api } from "../api/client";
import { useState } from "react";
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

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute top-[2px] -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function NavBar() {

  const [isGuest, setIsGuest] = useState(false);
  const [emailAttached, setEmailAttached] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [emailError, setEmailError] = useState(false);

  useEffect(() => {
    const checkGuestStatus = () => {
      setIsGuest(localStorage.getItem("isGuest") === "true");
      setEmailAttached(localStorage.getItem("guestEmailAttached") === "true");
    };
    checkGuestStatus();
    window.addEventListener("storage", checkGuestStatus);
    window.addEventListener("guest-email-attached", checkGuestStatus);
    return () => {
      window.removeEventListener("storage", checkGuestStatus);
      window.removeEventListener("guest-email-attached", checkGuestStatus);
    };
  }, []);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  
  const { vacationsPending, swapsIncoming, shiftChangesIncoming, timeOffsPending = 0, swapsAvailable = 0, refresh } = useNotifications();
  
  const org = useOrganization((s) => s.org);
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    if (user?.email !== import.meta.env.VITE_ADMIN_EMAIL) return;
    
    const updateCount = () => {
      supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});
    };

    updateCount();
    const interval = setInterval(updateCount, 10000);
    
    // 🔥 Слушаем событие из панели поддержки для мгновенного сброса
    window.addEventListener("support-unread-update", updateCount);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("support-unread-update", updateCount);
    };
  }, [user?.email]);

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const timeTrackingOn = org?.timeTrackingEnabled === true;

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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
              <img src="/favicon.svg" alt="Логотип" className="w-8 h-8 object-contain" />
            </button>

            <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 scrollbar-none flex-1">
              <button onClick={() => navigate("/")} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Дашборд
              </button>
              <button onClick={() => navigate("/my")} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/my") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Мой график
              </button>
              <button onClick={() => navigate("/swaps")} className={`relative px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/swaps") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Обмены
                <Badge value={swapsAvailable} />
              </button>
              <button onClick={() => navigate("/my-analytics")} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive(pathname, "/my-analytics") ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                Аналитика
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
              <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">
                <MessageSquare className="w-4 h-4" />
                <Badge value={supportUnread} />
              </button>
            )}
            <button
              onClick={() => navigate("/help")}
              className={`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/help")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Справка"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/profile")}
              className={`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${
                isActive(pathname, "/profile")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Профиль"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
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
            <img src="/favicon.svg" alt="Логотип" className="w-8 h-8 rounded-lg object-cover" />
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
          <button onClick={() => window.dispatchEvent(new Event("show-onboarding"))} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors" title="С чего начать">
            <ListChecks className="w-4 h-4" />
          </button>
          
          {user?.email === "prihodko999@inbox.ru" && (
            <button onClick={() => navigate("/admin-support")} className="relative flex items-center justify-center p-2 rounded-lg text-sm text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors" title="Панель поддержки">
              <MessageSquare className="w-4 h-4" />
              <Badge value={supportUnread} />
            </button>
          )}

          <button onClick={() => navigate("/help")} className={`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${isActive(pathname, "/help") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`} title="Справка">
            <HelpCircle className="w-4 h-4" />
          </button>
          {user?.role === "OWNER" && (
            <button onClick={() => navigate("/wallet")} className={`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${isActive(pathname, "/wallet") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`} title="Текущий тариф">
              <Wallet className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => navigate("/profile")} className={`relative flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${isActive(pathname, "/profile") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`} title="Профиль">
            <UserCircle className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="flex items-center justify-center p-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Выйти">
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
                if (link.path === "/swaps") badge = swapsIncoming + swapsAvailable;
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
