import { useEffect } from "react";
import WeekDetailPage from "./WeekDetailPage";
import { useWeeks } from "../store/weeks";
import { useUsers } from "../store/users";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useOrganization } from "../store/organization";
import { useGuestMode } from "../hooks/useGuestMode";
import { GUEST_SEED } from "../lib/guestSeed";

export default function GuestApp() {
  const { guestData } = useGuestMode();

  useEffect(() => {
    // Инициализируем "фейковый домен" в сторах, чтобы интерфейс ожил
    const seed = GUEST_SEED;
        useUsers.setState({ items: seed.employees });
        useShiftTemplates.setState({ items: seed.templates });
        useOrganization.setState({ org: seed.organization as any });

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
