import { create } from "zustand";
import { notificationsApi } from "../api/notifications";

type State = {
  vacationsPending: number;
  swapsIncoming: number;
  shiftChangesIncoming: number;
  refresh: () => Promise<void>;
};

export const useNotifications = create<State>((set) => ({
  vacationsPending: 0,
  swapsIncoming: 0,
  shiftChangesIncoming: 0,

  refresh: async () => {
    const [v, s, sc] = await Promise.all([
      notificationsApi.vacationsPendingCount(),
      notificationsApi.swapsIncomingCount(),
      notificationsApi.shiftChangesIncomingCount(),
    ]);
    set({
      vacationsPending: v,
      swapsIncoming: s,
      shiftChangesIncoming: sc,
    });
  },
}));