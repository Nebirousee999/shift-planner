import axios from "axios";
import { guestAdapter } from "./guestAdapter";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

  if (localStorage.getItem("guest_mode") === "true") {
    api.defaults.adapter = guestAdapter;
  }
  

// ─── Request interceptor: подставляем JWT ─────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: при 401 — разлогин ─────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
  if (!token) {
    const url = config.url || "";
    const method = config.method?.toUpperCase();
    let mockData = {};

    if (url.includes("/dashboard")) {
      mockData = { todayShifts: [], weekShifts: [], weekHours: 0, weekCost: 0, monthShifts: 0, monthCost: 0, employeesWorking: 0, swaps: 0, requests: 0 };
    } else if (url.includes("/schedule-weeks")) {
      mockData = [{ id: "week1", weekStartDate: new Date().toISOString().slice(0,10), status: "DRAFT", shifts: [] }];
    } else if (url.includes("/shift-templates")) {
      mockData = [{ id: "t1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" }];
    } else if (url.includes("/locations")) {
      mockData = [{ id: "loc1", name: "Основная", orgId: "org1" }];
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
    } else if (method === "GET") {
      mockData = []; // Для всех списков
    }

    // Подменяем адаптер Axios (запрос в сеть не уходит)
    config.adapter = () => Promise.resolve({
      data: mockData, status: 200, statusText: 'OK', headers: {}, config,
    });
  }
  return config;
});
