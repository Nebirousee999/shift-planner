import { create } from "zustand";
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
      if (wasGuest) {
        localStorage.setItem("guest_migrated", "true");
        localStorage.setItem("migrated_email", payload.email);
      }
      localStorage.removeItem("guestEmailAttached");
      if (wasGuest) {
        localStorage.setItem("guest_migrated", "true");
        localStorage.setItem("migrated_email", email);
      }
      localStorage.removeItem("migrated_email");
      localStorage.removeItem("activeLocationId");
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
      const wasGuest = localStorage.getItem("isGuest") === "true" || window.location.pathname.startsWith("/demo");
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