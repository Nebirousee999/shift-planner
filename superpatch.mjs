// superpatch.mjs (v3) — фикс гибрида гость/юзер:
// 1) GuestApp.tsx — полная перезапись: хуки до return, реактивный редирект реального юзера из /demo/*
// 2) store/auth.ts — полная перезапись: чистый login без дублей и бага payload.email
// 3) LandingPage.tsx — маппинг /demo/* для реального юзера (идемпотентно)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

function walk(d, name, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, name, out);
    else if (f === name) out.push(p);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 1. GuestApp.tsx — полная перезапись
// ─────────────────────────────────────────────────────────────
const guestApp = `import { useEffect } from "react";
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

export default function GuestApp() {
  const { pathname } = useLocation();

  // Заголовок и noindex — один раз при монтировании (хук до любых return — это важно)
  useEffect(() => {
    document.title = "Демо-режим | Планировщик смен";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, follow");
  }, []);

  // Реальный пользователь не должен жить в гостевом шелле.
  // Редирект срабатывает и при заходе на /demo/*, и в момент логина
  // из формы в гостевом новбаре (токен появился — выводим из демо).
  useEffect(() => {
    const redirectIfReal = () => {
      const token = localStorage.getItem("token");
      const isGuest = localStorage.getItem("isGuest") === "true";
      if (token && !isGuest) {
        const rest = pathname.replace(/^\/demo/, "") || "/dashboard";
        window.location.href = rest;
      }
    };
    redirectIfReal();
    const timer = setInterval(redirectIfReal, 800);
    return () => clearInterval(timer);
  }, [pathname]);

  const isMigrated = localStorage.getItem("guest_migrated") === "true";
  const migratedEmail = localStorage.getItem("migrated_email") || "вашим аккаунтом";

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

  // Гостю без токена ставим гостевые флаги (не трогаем сессию реального юзера)
  if (!localStorage.getItem("token") && localStorage.getItem("isGuest") !== "true") {
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("token", "guest-mock");
    localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
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
`;

const [guestFile] = walk(dir, "GuestApp.tsx");
if (!guestFile) { console.log("[ERROR] GuestApp.tsx не найден"); process.exit(1); }
fs.writeFileSync(guestFile, guestApp, "utf8");
const g1 = fs.readFileSync(guestFile, "utf8");
const hooksOk = g1.indexOf("useEffect") < g1.indexOf("if (isMigrated)");
const redirOk = g1.includes("redirectIfReal");
console.log(hooksOk && redirOk
  ? "[OK] GuestApp.tsx перезаписан и проверен: хуки до return, редирект на месте (" + guestFile.replace(dir + path.sep, "") + ")"
  : "[ERROR] GuestApp.tsx записан некорректно — пришли мне его содержимое");

// ─────────────────────────────────────────────────────────────
// 2. store/auth.ts — полная перезапись
// ─────────────────────────────────────────────────────────────
const authTs = `import { create } from "zustand";
import { api } from "../api/client";
import type { AuthResponse, User } from "../api/types";

type AuthState = {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    orgName: string;
  }) => Promise<boolean>;
  logout: () => void;
  setAuth: (token: string, user: User) => void;
  hydrate: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
};

// ─── Сброс organization-стора без циклического импорта ──
function resetOrganizationStore() {
  import("./organization")
    .then(({ useOrganization }) => {
      useOrganization.setState({ org: null });
    })
    .catch(() => {
      // если модуль не загрузился — не критично
    });
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: () => {
    const token = localStorage.getItem("token");
    // Фейковый пользователь для гостя
    const guestUser: User = { id: "guest", name: "Гость", email: "guest@local", role: "OWNER", orgId: "guest-org" };
    if (!token) {
      set({ token: null, user: guestUser, hydrated: true });
      return;
    }
    const userJson = localStorage.getItem("user");
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({ token, user, hydrated: true });
        return;
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    set({ hydrated: true });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const wasGuest = localStorage.getItem("isGuest") === "true" || window.location.pathname.startsWith("/demo");
      const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Реальный вход — снимаем гостевые флаги
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      if (wasGuest) {
        // Запоминаем, что гость перешёл в аккаунт — для развилки "Вы уже работали в аккаунте"
        localStorage.setItem("guest_migrated", "true");
        localStorage.setItem("migrated_email", email);
      }
      localStorage.removeItem("activeLocationId");
      // Сбрасываем старую организацию (если пользователь до этого был другой)
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;
    } catch (e: any) {
      const msg = e.response?.data?.error ?? "Ошибка входа";
      set({ error: msg, loading: false });
      return false;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<AuthResponse>("/auth/register", payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Реальный вход — снимаем гостевые флаги
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      localStorage.removeItem("activeLocationId");
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;
    } catch (e: any) {
      const msg = e.response?.data?.error ?? "Ошибка регистрации";
      set({ error: msg, loading: false });
      return false;
    }
  },

  setAuth: (token, user) => set({ token, user, hydrated: true }),

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("support_session_token"); // Очищаем сессию чата
    localStorage.removeItem("guestEmailAttached");
    // ВАЖНО: guest_migrated НЕ удаляем. Именно благодаря этому флагу
    // после выхода из профиля при клике на "Попробовать" появится развилка.
    localStorage.setItem("isGuest", "true");

    // Сбрасываем кэш организации и пользователей, чтобы при следующем входе
    // виджеты и таблицы не показывали данные предыдущего аккаунта
    resetOrganizationStore();
    import("./users").then(({ useUsers }) => {
      useUsers.setState({ items: [] });
    }).catch(() => {});

    set({ user: null, token: null });
  },

  changePassword: async (oldPassword, newPassword) => {
    await api.post("/me/change-password", { oldPassword, newPassword });
  },
}));
`;

const [authFile] = walk(dir, "auth.ts");
if (!authFile) {
  console.log("[WARN] store/auth.ts не найден — замени его содержимое вручную (код в моём сообщении)");
} else {
  fs.writeFileSync(authFile, authTs, "utf8");
  const a1 = fs.readFileSync(authFile, "utf8");
  const noBug = !a1.includes("payload.email");
  const oneMigrated = (a1.match(/migrated_email", email/g) || []).length === 1;
  console.log(noBug && oneMigrated
    ? "[OK] auth.ts перезаписан и проверен: бага payload.email нет, migrated_email ставится один раз (" + authFile.replace(dir + path.sep, "") + ")"
    : "[ERROR] auth.ts записан некорректно — пришли мне его содержимое");
}

// ─────────────────────────────────────────────────────────────
// 3. LandingPage.tsx — маппинг /demo/* для реального юзера
// ─────────────────────────────────────────────────────────────
const [lpFile] = walk(dir, "LandingPage.tsx");
if (!lpFile) {
  console.log("[WARN] LandingPage.tsx не найден — пропускаю");
} else {
  const raw = fs.readFileSync(lpFile, "utf8");
  if (raw.includes('target.replace("/demo"')) {
    console.log("[INFO] LandingPage: маппинг уже стоит — не трогаю");
  } else if (raw.includes("window.location.href = target;")) {
    const patched = raw.replaceAll(
      "window.location.href = target;",
      'window.location.href = target.startsWith("/demo") ? (target.replace("/demo", "") || "/dashboard") : target;'
    );
    fs.writeFileSync(lpFile, patched, "utf8");
    const l1 = fs.readFileSync(lpFile, "utf8");
    console.log(l1.includes('target.replace("/demo"')
      ? "[OK] LandingPage.tsx: /demo/* маппится на настоящий роут для реального юзера (" + lpFile.replace(dir + path.sep, "") + ")"
      : "[ERROR] LandingPage.tsx записан некорректно");
  } else {
    console.log("[WARN] LandingPage: якорь 'window.location.href = target;' не найден — ветка real-user могла измениться. GuestApp перехватит всё равно.");
  }
}

console.log("");
console.log("Готово. Сделай жёсткую перезагрузку страницы (Ctrl+Shift+R), чтобы Vite отдал свежие модули.");
console.log("Проверка: гость в демо -> логин из новбара -> должен сам открыться настоящий дашборд.");
