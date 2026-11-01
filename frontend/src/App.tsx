import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useOrganization } from "./store/organization";

// Основные страницы
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import TemplatesPage from "./pages/TemplatesPage";
import TeamPage from "./pages/TeamPage";
import WeeksPage from "./pages/WeeksPage";
import WeekDetailPage from "./pages/WeekDetailPage";
import TimePage from "./pages/TimePage";
import ProfilePage from "./pages/ProfilePage";
import MySchedulePage from "./pages/MySchedulePage";
import DocumentsPage from "./pages/DocumentsPage";
import SwapsPage from "./pages/SwapsPage";
import VacationsPage from "./pages/VacationsPage";
import TimesheetPage from "./pages/TimesheetPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HelpPage from "./pages/HelpPage";
import LocationsPage from "./pages/LocationsPage";
import SickLeavesPage from "./pages/SickLeavesPage";

// Публичные страницы
import AboutPage from "./pages/AboutPage";
import ContactsPage from "./pages/ContactsPage";
import LegalPage from "./pages/LegalPage";

// Глобальные компоненты
import DialogHost from "./components/DialogHost";
import CookieBanner from "./components/CookieBanner";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import HistoryPage from "./pages/HistoryPage";


function ProtectedRoute({
  children,
  adminOnly = false,
  employeeOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  employeeOnly?: boolean;
}) {
  const { token, user } = useAuth();
  
  if (!token) return <Navigate to="/welcome" replace />;

  const isEmployee = user?.role === "EMPLOYEE";
  if (adminOnly && isEmployee) return <Navigate to="/my" replace />;
  if (employeeOnly && !isEmployee) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default function App() {
  const { hydrate, token, hydrated } = useAuth();

  // 1. Гидратация auth из localStorage
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 2. После гидратации и при наличии токена — подтянуть организацию
  useEffect(() => {
    if (hydrated && token) {
      useOrganization.getState().fetch();
    }
  }, [hydrated, token]);

  if (!hydrated) return null;

  return (
    <BrowserRouter>
      <DialogHost />
      
      {/* Cookie-баннер рендерим глобально, чтобы он был на всех страницах */}
      <CookieBanner />
      
      <Routes>
        {/* ─── ПУБЛИЧНЫЕ (Лендинг и Авторизация) ─── */}
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <LoginPage />}
        />
        
        {/* Корень — лендинг для гостей, дашборд для авторизованных */}
        <Route path="/" element={token ? <DashboardPage /> : <LandingPage />} />
        
        {/* Прямая ссылка на лендинг (для редиректов из ProtectedRoute) */}
        <Route
          path="/welcome"
          element={token ? <Navigate to="/" replace /> : <LandingPage />}
        />

        {/* ─── ПУБЛИЧНЫЕ (Информационные страницы) ─── */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/offer" element={<LegalPage type="offer" />} />

        {/* ─── АДМИНСКИЕ (Только OWNER и MANAGER) ─── */}
        <Route path="/templates" element={<ProtectedRoute adminOnly><TemplatesPage /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute adminOnly><TeamPage /></ProtectedRoute>} />
        <Route path="/locations" element={<ProtectedRoute adminOnly><LocationsPage /></ProtectedRoute>} />
        <Route path="/vacations" element={<ProtectedRoute adminOnly><VacationsPage /></ProtectedRoute>} />
        <Route path="/weeks" element={<ProtectedRoute adminOnly><WeeksPage /></ProtectedRoute>} />
        <Route path="/weeks/:id" element={<ProtectedRoute adminOnly><WeekDetailPage /></ProtectedRoute>} />
        <Route path="/time" element={<ProtectedRoute adminOnly><TimePage /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute adminOnly><DocumentsPage /></ProtectedRoute>} />
        <Route path="/timesheet" element={<ProtectedRoute adminOnly><TimesheetPage /></ProtectedRoute>} />
        <Route path="/swaps" element={<ProtectedRoute><SwapsPage /></ProtectedRoute>} />
        <Route path="/sick-leaves" element={<ProtectedRoute adminOnly><SickLeavesPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />

        {/* ─── ОБЩИЕ (Для всех авторизованных) ─── */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
        
        {/* ─── СОТРУДНИК (Только EMPLOYEE) ─── */}
        <Route path="/my" element={<ProtectedRoute employeeOnly><MySchedulePage /></ProtectedRoute>} />

        {/* ─── 404 ─── */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/history" element={<ProtectedRoute adminOnly><HistoryPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}