declare global {
  interface Window {
    ym: (id: number, action: string, ...args: any[]) => void;
  }
}

// Твой ID счетчика Метрики
const COUNTER_ID = 114078577; 

export function trackEvent(eventName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(COUNTER_ID, "reachGoal", eventName, params);
      console.log(`[Metrika] Цель достигнута: ${eventName}`, params);
    }
  } catch (e) {
    // Игнорируем ошибки в проде
  }
}
