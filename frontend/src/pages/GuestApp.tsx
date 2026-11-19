import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import WeekDetailPage from "./WeekDetailPage";
import { api } from "../api/client";

export default function GuestApp() {
  useEffect(() => {
    const initGuest = async () => {
      const existingToken = localStorage.getItem("token");
      const isInvalidToken = !existingToken || existingToken === "undefined" || existingToken === "null";
      if (isInvalidToken) {
        try {
          const { data } = await api.post("/auth/guest-seed");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("isGuest", "true");
          localStorage.removeItem("guestEmailAttached");
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
  }, []);
  return <Navigate to="/weeks" replace />;
}