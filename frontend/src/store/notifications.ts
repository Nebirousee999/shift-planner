import { create } from "zustand";
import { notificationsApi, type InAppNotification } from "../api/notifications";

type State = {
  vacationsPending: number;
  swapsIncoming: number;
  shiftChangesIncoming: number;
  timeOffsPending: number;
  items: InAppNotification[];
  unreadTotal: number;
  refresh: () => Promise<void>;
  fetchMine: () => Promise<void>;
  ack: (id: string) => Promise<void>;
  ackAll: () => Promise<void>;
  optimisticResolve: (id: string, status: "APPROVED" | "REJECTED") => void;
};

export const useNotifications = create<State>((set, get) => ({
  vacationsPending: 0,
  swapsIncoming: 0,
  shiftChangesIncoming: 0,
  timeOffsPending: 0,
  items: [],
  unreadTotal: 0,

  refresh: async () => {
    const [v, s, sc, t, items, unread] = await Promise.all([
      notificationsApi.vacationsPendingCount(),
      notificationsApi.swapsIncomingCount(),
      notificationsApi.shiftChangesIncomingCount(),
      notificationsApi.timeOffsPendingCount(),
      notificationsApi.listMine(),
      notificationsApi.unreadInAppCount(),
    ]);
    set({
      vacationsPending: v,
      swapsIncoming: s,
      shiftChangesIncoming: sc,
      timeOffsPending: t,
      items,
      unreadTotal: unread,
    });
  },

  fetchMine: async () => {
    const items = await notificationsApi.listMine();
    set({ items });
  },

  ack: async (id) => {
    await notificationsApi.ackInApp(id);
    await get().refresh();
  },

  ackAll: async () => {
    await notificationsApi.ackAllInApp();
    await get().refresh();
  },

  optimisticResolve: (id, status) => {
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = target && !target.acknowledgedAt;
      return {
        items: state.items.map((n) =>
          n.id === id
            ? {
                ...n,
                requiresAction: false,
                acknowledgedAt: new Date().toISOString(),
                title: status === "APPROVED" ? "Запрос одобрен" : "Запрос отклонён",
                payload: { ...((n.payload as any) || {}), resolved: status },
              }
            : n
        ),
        unreadTotal: wasUnread ? Math.max(0, state.unreadTotal - 1) : state.unreadTotal,
      };
    });
  },
}));
