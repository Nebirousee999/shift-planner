import { create } from "zustand";
import { notificationsApi } from "../api/notifications";

type State = {
  vacationsPending: number;
  swapsIncoming: number;
  refresh: () => Promise<void>;
};

export const useNotifications = create<State>((set) => ({
  vacationsPending: 0,
  swapsIncoming: 0,

  refresh: async () => {
    const [v, s] = await Promise.all([
      notificationsApi.vacationsPendingCount(),
      notificationsApi.swapsIncomingCount(),
    ]);
    set({ vacationsPending: v, swapsIncoming: s });
  },
}));