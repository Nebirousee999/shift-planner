import { api } from "./client";

export const notificationsApi = {
  vacationsPendingCount: async (): Promise<number> => {
    try {
      const { data } = await api.get<{ count: number }>(
        "/vacations/pending/count"
      );
      return data.count;
    } catch {
      return 0;
    }
  },

  swapsIncomingCount: async (): Promise<number> => {
    try {
      const { data } = await api.get<{ count: number }>(
        "/swaps/incoming/count"
      );
      return data.count;
    } catch {
      return 0;
    }
  },
};