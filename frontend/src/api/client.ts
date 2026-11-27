import axios from "axios";
import { GUEST_SEED } from "../lib/guestSeed";
import { guestAdapter } from "./guestAdapter";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export 
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Убираем гостевые ID локаций (gloc1, gloc2), чтобы они не улетали на реальный бэкенд
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && localStorage.getItem("isGuest") !== "true") {
    if (config.params && config.params.locationId && String(config.params.locationId).startsWith("gloc")) {
      delete config.params.locationId;
    }
  }
  return config;
});


  
  


// ─── Request interceptor: подставляем JWT или используем guestAdapter ─────────────
api.interceptors.request.use((config) => {
  const isGuest = localStorage.getItem("isGuest") === "true" || window.location.pathname.startsWith('/demo');
  const token = localStorage.getItem("token");
  const url = config.url || "";

  // Если это демо-режим и не авторизация — используем локальный адаптер (localStorage)
  const bypassAuth = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/quick-register") || url.includes("/auth/reset-password");
  
  if (isGuest && !bypassAuth) {
    config.adapter = guestAdapter;
  }

  // Если это реальный пользователь — подставляем токен
  if (!isGuest && token && token !== "undefined" && token !== "null" && token !== "guest-mock") {
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
    const isGuest = localStorage.getItem("isGuest") === "true" || window.location.pathname.startsWith('/demo');
    
    if (error.response?.status === 401 && !isAuthRequest && !isGuest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);
