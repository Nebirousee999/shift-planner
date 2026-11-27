import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import DashboardPage from "./DashboardPage";
import WeeksPage from "./WeeksPage";
import WeekDetailPage from "./WeekDetailPage";
import SwapsPage from "./SwapsPage";
import TeamPage from "./TeamPage";
import AnalyticsPage from "./AnalyticsPage";
import DocumentsPage from "./DocumentsPage";
import TimesheetPage from "./TimesheetPage";
import VacationsPage from "./VacationsPage";
import SickLeavesPage from "./SickLeavesPage";
import HistoryPage from "./HistoryPage";
import TemplatesPage from "./TemplatesPage";

// Маппим гостевой путь на настоящий роут приложения.
// Строковыми методами, без регулярок — чтобы не зависеть от экранирования.
function mapDemoPath(pathname: string): string {
  if (pathname === "/demo" || pathname === "/demo/") return "/dashboard";
  if (pathname.startsWith("/demo/")) {
    const rest = pathname.slice("/demo".length);
    return rest || "/dashboard";
  }
  return "/dashboard";
}

export default function GuestApp() {
  const { pathname } = useLocation();

  // Реальный пользователь не должен находиться в гостевом шелле.
  // Эффект срабатывает и при заходе на /demo/*, и в момент логина
  // из формы в гостевом новбаре (состояние меняется без перезагрузки),
  // поэтому опрашиваем localStorage с небольшим интервалом.
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem("token");
      const isGuest = localStorage.getItem("isGuest") === "true";
      const isRealUser = !!token && token !== "guest-mock" && !isGuest;
      if (isRealUser) {
        window.location.replace(mapDemoPath(window.location.pathname));
      }
    };
    check();
    const interval = window.setInterval(check, 800);
    return () => window.clearInterval(interval);
  }, []);

  const isMigrated = localStorage.getItem("guest_migrated") === "true";
  const migratedEmail = localStorage.getItem("migrated_email") || "вашим аккаунтом";

  // Все хуки объявлены ДО любых условных return — иначе React падает
  // из-за меняющегося числа хуков между рендерами.
  useEffect(() => {
    const token = localStorage.getItem("token");
    // Не ломаем сессию реального пользователя: проставляем гостевые флаги
    // только тем, кто зашёл в демо без аккаунта.
    if ((!token || token === "guest-mock") && localStorage.getItem("isGuest") !== "true") {
      localStorage.setItem("isGuest", "true");
      localStorage.setItem("token", "guest-mock");
      localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
    }

    document.title = "Демо-режим | Планировщик смен";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, follow");
  }, []);

  if (isMigrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Вы уже работали в аккаунте</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Данные вашего графика сохранены в аккаунте <b>{migratedEmail}</b>.<br/>Пожалуйста, войдите, чтобы продолжить.
          </p>
          <button onClick={() => window.location.href = "/login"} className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-brand-700 shadow-sm transition-all">
            <LogIn className="w-5 h-5" /> Войти в аккаунт
          </button>
          <button onClick={() => { localStorage.removeItem("guest_migrated"); window.location.reload(); }} className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline">
            Или начать с чистого листа
          </button>
        </div>
      </div>
    );
  }

  if (pathname === "/demo" || pathname === "/demo/") {
    return <Navigate to="/demo/dashboard" replace />;
  }

  return (
    <Routes>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="weeks" element={<WeeksPage />} />
      <Route path="weeks/:id" element={<WeekDetailPage />} />
      <Route path="swaps" element={<SwapsPage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="vacations" element={<VacationsPage />} />
      <Route path="sick-leaves" element={<SickLeavesPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="timesheet" element={<TimesheetPage />} />
      <Route path="templates" element={<TemplatesPage />} />
      <Route path="*" element={<Navigate to="/demo/dashboard" replace />} />
    </Routes>
  );
}
