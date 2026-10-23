declare global {
  interface Window {
    ym: (id: number, action: string, ...args: any[]) => void;
  }
}

// Замени 99999999 на свой реальный ID счетчика Метрики
const COUNTER_ID = 99999999; 

export function trackEvent(eventName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(COUNTER_ID, "reachGoal", eventName, params);
      console.log(`[Metrika] Event tracked: ${eventName}`, params);
    }
  } catch (e) {
    // Игнорируем ошибки (например, если включен AdBlock)
  }
}