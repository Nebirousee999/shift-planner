import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

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