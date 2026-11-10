// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function writeFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Перезаписан");
}

// ═══ 1. Оптимизируем сборку Vite (разбиваем на чанки) ═══
writeFile(
  "frontend/vite.config.ts",
  `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Планировщик смен",
        short_name: "Смены",
        description: "Планирование смен, учёт рабочего времени и отпусков для микробизнеса",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "ru",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\\/api/],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "zustand", "axios"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
`,
  "frontend/vite.config.ts"
);

// ═══ 2. App.tsx — включаем React.lazy для всех страниц ═══
// Это разобьет 1.5 МБ на кусочки по 10-50 КБ. Сайт будет грузиться моментально.
writeFile(
  "frontend/src/App.tsx",
  `import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import { useOrganization } from "./store/organization";

// Основные страницы (Lazy Loading)
const LoginPage = lazy(() => import("./pages/LoginPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
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

// Глобальные компоненты (оставляем синхронными, они нужны сразу)
import DialogHost from "./components/DialogHost";
import OnboardingWidget from "./components/OnboardingWidget";
import CookieBanner from "./components/CookieBanner";
import ScrollToTop from "./components/ScrollToTop";
import SupportWidget from "./components/SupportWidget";

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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && token) {
      useOrganization.getState().fetch();
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
          <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={token ? <DashboardPage /> : <LandingPage />} />
          <Route path="/welcome" element={token ? <Navigate to="/" replace /> : <LandingPage />} />
          
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
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
`,
  "frontend/src/App.tsx"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Код разбит на чанки (Lazy Loading).");
} else {
  console.log("⚠️ Изменений не внесено.");
}