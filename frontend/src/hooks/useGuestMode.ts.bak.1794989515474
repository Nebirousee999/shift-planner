import { useState, useEffect } from "react";

export function useGuestMode() {
  const [guestData, setGuestData] = useState(() => {
    // Пытаемся загрузить сохраненный "фейковый домен" из памяти браузера
    const saved = localStorage.getItem("guest_workspace");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      employees: [
        { id: "g1", name: "Алексей", position: "Бариста", hourlyRate: "300" },
        { id: "g2", name: "Мария", position: "Кассир", hourlyRate: "250" }
      ],
      shifts: [],
      startDate: new Date().toISOString().slice(0, 10),
    };
  });

  // Автоматически сохраняем любые изменения в localStorage
  useEffect(() => {
    localStorage.setItem("guest_workspace", JSON.stringify(guestData));
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
