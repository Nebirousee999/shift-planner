import { useState, useEffect } from "react";
import { GUEST_SEED } from "../lib/guestSeed";

export function useGuestMode() {
  const [guestData, setGuestData] = useState(() => {
    // Пытаемся загрузить сохраненный "фейковый домен" из памяти браузера
    const saved = localStorage.getItem("guest_workspace");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Проверяем, что это новые данные (Анна Смирнова)
        if (parsed && parsed.employees && parsed.employees[0]?.name === "Анна Смирнова") {
          return parsed;
        }
      } catch (e) { /* ignore */ }
    }
    const seed = GUEST_SEED;
        return {
          employees: seed.employees,
          shifts: seed.shifts,
          startDate: seed.weekStart,
        };
  });

  // Автоматически сохраняем любые изменения в localStorage
  useEffect(() => {
      localStorage.setItem("guest_workspace", JSON.stringify(guestData));
      if (guestData.shifts && guestData.shifts.length > 0) {
        const existing = localStorage.getItem("guest_shifts");
        if (!existing || existing === "[]") {
          localStorage.setItem("guest_shifts", JSON.stringify(guestData.shifts));
        }
      }
    }, [guestData]);

  const addGuestEmployee = (emp: any) => {
    setGuestData((prev) => ({ ...prev, employees: [...prev.employees, emp] }));
  };

  const addGuestShift = (shift: any) => {
    setGuestData((prev) => ({ ...prev, shifts: [...prev.shifts, shift] }));
  };

  const removeGuestShift = (id: string) => {
    setGuestData((prev) => ({ ...prev, shifts: prev.shifts.filter((s: any) => s.id !== id) }));
  };

  return { guestData, addGuestEmployee, addGuestShift, removeGuestShift };
}
