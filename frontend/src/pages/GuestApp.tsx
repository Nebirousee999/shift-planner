import { useEffect } from "react";
import WeekDetailPage from "./WeekDetailPage";
import { useWeeks } from "../store/weeks";
import { useUsers } from "../store/users";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useOrganization } from "../store/organization";
import { useGuestMode } from "../hooks/useGuestMode";

export default function GuestApp() {
  const { guestData } = useGuestMode();

  useEffect(() => {
    // Инициализируем "фейковый домен" в сторах, чтобы интерфейс ожил
    useUsers.setState({ items: guestData.employees });
    useShiftTemplates.setState({
      items: [
        { id: "t1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" },
        { id: "t2", name: "Вечерняя", startTime: "14:00", endTime: "22:00", color: "#F59E0B" }
      ]
    });
    useOrganization.setState({ org: { positionHeaderOpacity: 70, positionRowOpacity: 20 } });

    useWeeks.setState({
      currentWeek: {
        id: "guest-week",
        weekStartDate: guestData.startDate,
        status: "DRAFT",
        shifts: guestData.shifts
      },
      loading: false,
      error: null,
      fetchWeek: async () => {},
      publishWeek: async () => ({ ok: true })
    });
  }, [guestData]);

  return <WeekDetailPage />;
}
