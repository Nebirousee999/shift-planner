import { useAuth } from "./store/auth";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useOrganization } from "./store/organization";
import { meApi } from "./api/me";

// Основные страницы (Lazy Loading)
const LoginPage = lazy(() => import("./pages/LoginPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const AdminDatabasePage = lazy(() => import("./pages/AdminDatabasePage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticlePage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const WeeksPage = lazy(() => import("./pages/WeeksPage"));
const WeekDetailPage = lazy(() => import("./pages/WeekDetailPage"));
const TimePage = lazy(() => import("./pages/TimePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MySchedulePage = lazy(() => import("./pages/MySchedulePage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const SwapsPage = lazy(() => import("./pages/SwapsPage"));
const VacationsPage = lazy(() => import("./pages/VacationsPage"));
const TimesheetPage = lazy(() => import("./pages/TimesheetPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const SickLeavesPage = lazy(() => import("./pages/SickLeavesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));

// Глобальные компоненты
import DialogHost from "./components/DialogHost";
import OnboardingWidget from "./components/OnboardingWidget";
import CookieBanner from "./components/CookieBanner";
import ScrollToTop from "./components/ScrollToTop";
import SupportWidget from "./components/SupportWidget";
import GuestApp from "./pages/GuestApp";

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
  const location = useLocation();
  const isGuest = localStorage.getItem("isGuest") === "true";

  // Если это гость — принудительно отправляем в /demo
  if (isGuest) {
    return <Navigate to={`/demo${location.pathname}`} replace />;
  }

  if (!token) return <Navigate to="/" replace />;

  const isEmployee = user?.role === "EMPLOYEE";
  if (adminOnly && isEmployee) return <Navigate to="/my" replace />;
  if (employeeOnly && !isEmployee) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}


function InfoRoute() {
  const { token, hydrated } = useAuth();
  if (!hydrated) return null;
  const isGuest = localStorage.getItem("isGuest") === "true";
  if (token && isGuest) return <LandingPage />;
  return <Navigate to="/" replace />;
}

function CalcRoute() {
  const { token, hydrated } = useAuth();
  if (!hydrated) return null;
  const isGuest = localStorage.getItem("isGuest") === "true";
  // После регистрации с /calc ведём на /weeks, а не на главную,
  // иначе <Navigate to="/" /> перебивает navigate("/weeks") из CalculatorPage.
  if (token && !isGuest) return <Navigate to="/weeks" replace />;
  return <CalculatorPage />;
}

function LoginRoute() {
  const { token, hydrated } = useAuth();
  if (!hydrated) return null;
  const isGuest = localStorage.getItem("isGuest") === "true";
  if (token && !isGuest) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  const { hydrate, token, hydrated } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && token) {
      useOrganization.getState().fetch();
      
      // Автосинхронизация профиля (лечит зависший guest_email)
      meApi.profile().then(p => {
        if (p) {
          const currentUser = useAuth.getState().user;
          if (currentUser && (currentUser.email !== p.email || currentUser.role !== p.role || currentUser.name !== p.name)) {
            const newUser = { ...currentUser, email: p.email, role: p.role, name: p.name };
            useAuth.setState({ user: newUser });
            localStorage.setItem("user", JSON.stringify(newUser));
          }
        }
      }).catch(() => {});
    }
  }, [hydrated, token]);

  if (!hydrated) return null;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <DialogHost />
      <OnboardingWidget />
      <CookieBanner />
      <SupportWidget />
      
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Загрузка...</div>}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/calc" element={<CalcRoute />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/info" element={<InfoRoute />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contacts" element={<Navigate to="/" replace />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/offer" element={<LegalPage type="offer" />} />

          <Route path="/templates" element={<ProtectedRoute adminOnly><TemplatesPage /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute adminOnly><TeamPage /></ProtectedRoute>} />
          <Route path="/locations" element={<ProtectedRoute adminOnly><LocationsPage /></ProtectedRoute>} />
          <Route path="/vacations" element={<ProtectedRoute adminOnly><VacationsPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/weeks" element={<ProtectedRoute adminOnly><WeeksPage /></ProtectedRoute>} />
          <Route path="/weeks/:id" element={<ProtectedRoute adminOnly><WeekDetailPage /></ProtectedRoute>} />
          <Route path="/time" element={<ProtectedRoute adminOnly><TimePage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute adminOnly><DocumentsPage /></ProtectedRoute>} />
          <Route path="/timesheet" element={<ProtectedRoute adminOnly><TimesheetPage /></ProtectedRoute>} />
          <Route path="/swaps" element={<ProtectedRoute><SwapsPage /></ProtectedRoute>} />
          <Route path="/my-analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/sick-leaves" element={<ProtectedRoute adminOnly><SickLeavesPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute adminOnly><WalletPage /></ProtectedRoute>} />

          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
          <Route path="/my" element={<ProtectedRoute employeeOnly><MySchedulePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/history" element={<ProtectedRoute adminOnly><HistoryPage /></ProtectedRoute>} />
          <Route path="/admin-support" element={<ProtectedRoute><AdminSupportPage /></ProtectedRoute>} />
          <Route path="/admin-database" element={<ProtectedRoute><AdminDatabasePage /></ProtectedRoute>} />
        
        <Route path="/demo/*" element={<GuestApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
