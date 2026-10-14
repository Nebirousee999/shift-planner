import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import LoginPage from "./pages/LoginPage";
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
import DialogHost from "./components/DialogHost";
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

  if (!token) return <Navigate to="/login" replace />;

  const isAdmin = user?.role === "OWNER" || user?.role === "MANAGER";
  const isEmployee = user?.role === "EMPLOYEE";

  if (adminOnly && isEmployee) return <Navigate to="/my" replace />;
  if (employeeOnly && !isEmployee) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  const { hydrate, token, user, hydrated } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  const homePath = user?.role === "EMPLOYEE" ? "/my" : "/";

  return (
    <BrowserRouter>
      <DialogHost />
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to={homePath} replace /> : <LoginPage />}
        />

        {/* ─── Админские ─── */}
        <Route
          path="/"
          element={
            <ProtectedRoute adminOnly>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute adminOnly>
              <TemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute adminOnly>
              <TeamPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vacations"
          element={
            <ProtectedRoute adminOnly>
              <VacationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/weeks"
          element={
            <ProtectedRoute adminOnly>
              <WeeksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/weeks/:id"
          element={
            <ProtectedRoute adminOnly>
              <WeekDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/time"
          element={
            <ProtectedRoute adminOnly>
              <TimePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/documents"
          element={
            <ProtectedRoute adminOnly>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/timesheet"
          element={
            <ProtectedRoute adminOnly>
              <TimesheetPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/swaps"
          element={
            <ProtectedRoute adminOnly>
              <SwapsPage />
            </ProtectedRoute>
          }
        />

        {/* ─── Общие ─── */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute adminOnly>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          }
        />

        {/* ─── Сотрудник ─── */}
        <Route
          path="/my"
          element={
            <ProtectedRoute employeeOnly>
              <MySchedulePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </BrowserRouter>
  );
}