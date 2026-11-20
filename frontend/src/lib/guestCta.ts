import { trackEvent } from "./metrika";

// Гостевой вход и переход — та же логика, что у handleRegisterClick на лендинге.
// target "/" по умолчанию — как у кнопки «Начать бесплатно» в шапке.
export async function startGuestNavigate(
  source: string,
  target: string = "/",
  fallback?: () => void
) {
  trackEvent("CTA_click", { source });
  if (localStorage.getItem("isGuest") === "true" && localStorage.getItem("token")) {
    window.location.href = target;
    return;
  }
  try {
    const { api } = await import("../api/client");
    const { data } = await api.post("/auth/guest-seed");
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("isGuest", "true");
    localStorage.removeItem("activeLocationId");
    localStorage.removeItem("guest_workspace");
    localStorage.removeItem("guest_db");
    localStorage.removeItem("guest_db_version");
    localStorage.removeItem("guest_shifts");
    localStorage.removeItem("guestEmailAttached");
    window.location.href = target;
  } catch (e) {
    console.error("Ошибка создания гостевой сессии:", e);
    if (fallback) fallback();
    else window.location.href = "/login?mode=register";
  }
}
