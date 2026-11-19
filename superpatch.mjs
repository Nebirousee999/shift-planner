import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// 1. Полная замена App.tsx на исправленную версию
// Это гарантирует отсутствие "висячих" закрывающих тегов, которые вызвали ошибку
const appTsxContent = `import { useAuth } from "./store/auth";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useOrganization } from "./store/organization";

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
  const isGuest = !token;
  if (isGuest) return <>{children}</>;

  const isEmployee = user?.role === "EMPLOYEE";
  if (adminOnly && isEmployee) return <Navigate to="/my" replace />;
  if (employeeOnly && !isEmployee) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default function App() {
  const { hydrate, token, hydrated } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const initGuest = async () => {
      const lsToken = localStorage.getItem("token");
      const isInvalidToken = !lsToken || lsToken === "undefined" || lsToken === "null";
      if (!token && isInvalidToken) {
        try {
          const { api } = await import("./api/client");
          const { data } = await api.post("/auth/guest-seed");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("isGuest", "true");
          window.location.reload();
        } catch (e) {
          console.error("Ошибка создания гостевой сессии:", e);
          localStorage.setItem("token", "guest-mock");
          localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
          localStorage.setItem("isGuest", "true");
          window.location.reload();
        }
      }
    };
    initGuest();
  }, [token]);

  useEffect(() => {
    if (hydrated && token) {
      useOrganization.getState().fetch();
    }
  }, [hydrated, token]);

  if (!hydrated && token) return null;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <DialogHost />
      <OnboardingWidget />
      <CookieBanner />
      <SupportWidget />
      
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Загрузка...</div>}>
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/calc" element={token ? <Navigate to="/weeks" replace /> : <CalculatorPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/info" element={<LandingPage />} />
          <Route path="/welcome" element={token ? <Navigate to="/" replace /> : <Navigate to="/info" replace />} />
          
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
        
        <Route path="/demo" element={<GuestApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
`;

fs.writeFileSync(path.join(ROOT, "frontend/src/App.tsx"), appTsxContent, "utf-8");
console.log("✅ App.tsx: полностью перезаписан (удалены остатки гостевой плашки и лишние импорты)");

// 2. Проверка NavBar.tsx на наличие guestBanner
const navBarPath = path.join(ROOT, "frontend/src/components/NavBar.tsx");
if (fs.existsSync(navBarPath)) {
  let navBarSrc = fs.readFileSync(navBarPath, "utf-8");
  let changed = 0;

  if (!navBarSrc.includes("const guestBanner = ")) {
    const guestBannerCode = `  const guestBanner = isGuest && !emailAttached && (
    <div className="bg-amber-50 border-b border-amber-200 w-full shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col items-center justify-center gap-2">
        <div className="text-amber-800 text-sm font-medium flex items-center gap-2 text-center">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Вы зашли как гость. Чтобы не потерять данные,{" "}
            <button onClick={() => { if (showEmailInput) setEmailError(true); else setShowEmailInput(true); }} className="underline font-bold hover:text-amber-900 transition-colors">
              введите вашу почту
            </button>.
          </span>
        </div>
        {showEmailInput && (
          <div className="flex items-center gap-2 animate-fade-in pb-1">
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => { setGuestEmail(e.target.value); setEmailError(false); }}
              placeholder="your@email.ru"
              className={\`py-1.5 px-3 text-sm w-64 rounded-lg bg-white border \${emailError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-amber-300'}\`}
            />
            <button
              onClick={async () => {
                if (!guestEmail.includes("@")) { setEmailError(true); return; }
                try {
                  await api.post("/auth/update-email", { email: guestEmail });
                  localStorage.setItem("guestEmailAttached", "true");
                  setEmailAttached(true);
                  setShowEmailInput(false);
                  alert("Почта привязана!");
                } catch (e: any) {
                  setEmailError(true);
                  alert(e.response?.data?.error ?? "Ошибка привязки почты");
                }
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              Привязать
            </button>
          </div>
        )}
      </div>
    </div>
  );

`;
    navBarSrc = navBarSrc.replace("  if (!isAdmin) {", guestBannerCode + "  if (!isAdmin) {");
    console.log("✅ NavBar.tsx: добавлена переменная guestBanner");
    changed++;
  }

  const headerEmployee = `<header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/90">`;
  const headerAdmin = `<header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm bg-white/95">`;

  if (navBarSrc.includes(headerEmployee) && !navBarSrc.includes(headerEmployee + "\n      {guestBanner}")) {
    navBarSrc = navBarSrc.replace(headerEmployee, headerEmployee + "\n      {guestBanner}");
    console.log("✅ NavBar.tsx: добавлен {guestBanner} в header (сотрудник)");
    changed++;
  }

  if (navBarSrc.includes(headerAdmin) && !navBarSrc.includes(headerAdmin + "\n      {guestBanner}")) {
    navBarSrc = navBarSrc.replace(headerAdmin, headerAdmin + "\n      {guestBanner}");
    console.log("✅ NavBar.tsx: добавлен {guestBanner} в header (админ)");
    changed++;
  }

  if (changed > 0) {
    fs.writeFileSync(navBarPath, navBarSrc, "utf-8");
  } else {
    console.log("ℹ️ NavBar.tsx: изменений не требуется (всё уже на месте)");
  }
} else {
  console.warn("⚠️ Файл NavBar.tsx не найден");
}

console.log("\n✅ Готово! Перезапустите фронтенд (npm run dev).");