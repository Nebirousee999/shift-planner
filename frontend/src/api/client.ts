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
    if (error.response?.status === 401 && localStorage.getItem("isGuest") === "true") {
      localStorage.setItem("token", "guest-mock");
      localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
    } else if (error.response?.status === 401) {
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
    // Не подменяем адаптер для создания гостевой сессии — запрос должен уйти на реальный сервер
    if (url.includes("/auth/guest-seed") && token !== "guest-mock") {
      return config;
    }
    const method = config.method?.toUpperCase();
    let mockData: any = null;

    if (url.includes("/dashboard")) {
      mockData = {
        currentWeek: { id: "week1", orgId: "org1", locationId: "loc1", weekStartDate: new Date().toISOString().slice(0,10), status: "DRAFT", publishedAt: null, createdAt: new Date().toISOString(), shifts: [] },
        weekTimeEntries: [],
        users: [{ id: "u1", name: "Алексей", position: "Бариста", hourlyRate: "300", color: "#3B82F6", locationIds: ["loc1"], areaIds: [] }]
      };
    } else if (url.includes("/schedule-weeks") && method === "GET") {
      const parts = url.split("/");
      if (parts.length > 2 && parts[parts.length - 1] !== "schedule-weeks") {
        mockData = { id: parts[parts.length - 1], orgId: "org1", locationId: "loc1", weekStartDate: new Date().toISOString().slice(0,10), status: "DRAFT", publishedAt: null, createdAt: new Date().toISOString(), shifts: [] };
      } else {
        mockData = [{ id: "week1", orgId: "org1", locationId: "loc1", weekStartDate: new Date().toISOString().slice(0,10), status: "DRAFT", publishedAt: null, createdAt: new Date().toISOString(), shifts: [] }];
      }
    } else if (url.includes("/shift-templates")) {
      mockData = [{ id: "t1", orgId: "org1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" }];
    } else if (url.includes("/locations")) {
      mockData = [{ id: "loc1", orgId: "org1", name: "Основная", address: null, city: null, phone: null, isArchived: false, createdAt: new Date().toISOString() }];
    } else // Если это POST (создание сотрудника)
      if (url.includes("/users") && method === "POST") {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
        return Promise.resolve({
          data: {
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
          }
        });
      }

      // Если это GET (список сотрудников)
      if (url.includes("/users") && method === "GET") {
      mockData = [{ id: "u1", name: "Алексей", position: "Бариста", hourlyRate: "300", color: "#3B82F6", locationIds: ["loc1"], areaIds: [] }];
    } else if (url.includes("/organization")) {
        return Promise.resolve({ data: { id: "org1", name: "Моя компания", tariffId: "pro", positionHeaderOpacity: 70, positionRowOpacity: 20 } });
      }
      if (url.includes("/me")) {
      mockData = { id: "guest", name: "Владелец", role: "OWNER", email: "guest@test.ru", orgId: "org1" };
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
