import axios from "axios";
import { GUEST_SEED } from "../lib/guestSeed";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

  
  

// ─── Request interceptor: подставляем JWT ─────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && token !== "undefined" && token !== "null") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: при 401 — разлогин ─────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = (error.config?.url || "");
    const isAuthRequest = url.includes("/auth/");
    if (error.response?.status === 401 && localStorage.getItem("isGuest") === "true" && !isAuthRequest) {
      localStorage.setItem("token", "guest-mock");
      localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
    } else if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Жесткий редирект убран, чтобы не выкидывать с лендинга на логин
    }
    return Promise.reject(error);
  }
);




// ГОСТЕВОЙ ПЕРЕХВАТЧИК API (100% без ошибок 401)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const isInvalidToken = !token || token === "undefined" || token === "null" || token === "guest-mock";
  if (isInvalidToken) {
    const url = config.url || "";
    // Auth-запросы (логин, регистрация, сброс пароля, привязка email) ВСЕГДА идут в реальную сеть.
    // Иначе из гостевого режима невозможно выйти и войти в реальный аккаунт.
    if (url.includes("/auth/")) {
      return config;
    }
    const method = config.method?.toUpperCase();
    let mockData: any = null;

    if (url.includes("/dashboard")) {
      mockData = {
        currentWeek: { id: GUEST_SEED.weekId, orgId: GUEST_SEED.organization.id, locationId: GUEST_SEED.locations[0].id, weekStartDate: GUEST_SEED.weekStart, status: "PUBLISHED", publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), shifts: GUEST_SEED.shifts },
        weekTimeEntries: [],
        users: GUEST_SEED.employees
      };
    } else if (url.includes("/schedule-weeks") && method === "GET") {
      const parts = url.split("/");
      const isDetail = parts.length > 2 && parts[parts.length - 1] !== "schedule-weeks";
      const weekData = { id: GUEST_SEED.weekId, orgId: GUEST_SEED.organization.id, locationId: GUEST_SEED.locations[0].id, weekStartDate: GUEST_SEED.weekStart, status: "PUBLISHED", publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), shifts: GUEST_SEED.shifts };
      if (isDetail) {
        mockData = { ...weekData, id: parts[parts.length - 1] };
      } else {
        mockData = [weekData];
      }
    } else if (url.includes("/shift-templates")) {
      mockData = GUEST_SEED.templates;
    } else if (url.includes("/locations")) {
      mockData = GUEST_SEED.locations;
    } else // Если это POST (создание сотрудника)
      if (url.includes("/users") && method === "POST") {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
        mockData = {
          user: {
            id: Math.random().toString(),
            name: body.name || "Новый сотрудник",
            email: body.email || "new@test.ru",
            phone: body.phone || null,
            role: body.role || "EMPLOYEE",
            position: body.position || null,
            hourlyRate: body.hourlyRate || null,
            createdAt: new Date().toISOString(),
            locationIds: body.locationIds || [],
            areaIds: body.areaIds || [],
            paymentType: body.paymentType || "HOURLY",
            employmentType: body.employmentType || "SHTAT",
            color: body.color || "#3B82F6",
            tempPassword: "temp123",
            isTempPasswordSent: false
          },
          tempPassword: "temp123"
        };
      }

      // Если это GET (список сотрудников)
      if (url.includes("/users") && method === "GET") {
      mockData = GUEST_SEED.employees;
    } else if (url.includes("/organization")) {
        mockData = GUEST_SEED.organization;
      }
      if (url.includes("/me")) {
      mockData = GUEST_SEED.me;
    } else if (url.includes("/count")) {
      mockData = { count: 0 };
    } else if (method === "GET" && mockData === null) {
      mockData = []; // Только если ещё ничего не задано
    }

    if (mockData === null) {
      mockData = method === "GET" ? [] : {};
    }

    // Подменяем адаптер Axios (запрос в сеть не уходит)
    config.adapter = () => Promise.resolve({
      data: mockData, status: 200, statusText: 'OK', headers: {}, config,
    });
  }
  return config;
});
