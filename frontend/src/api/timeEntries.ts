import { api } from "./client";

export type TimeEntry = {
  id: string;
  userId: string;
  shiftId: string | null;
  clockIn: string | null;
  clockOut: string | null;
  source: string;
  createdAt: string;
  userName?: string;
};

export const timeEntriesApi = {
  list: async (filters: {
    userId?: string;
    from?: string;
    to?: string;
  } = {}): Promise<TimeEntry[]> => {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    const { data } = await api.get<TimeEntry[]>(
      `/time-entries${qs ? "?" + qs : ""}`
    );
    return data;
  },

  getActive: async (): Promise<TimeEntry | null> => {
    const { data } = await api.get<TimeEntry | null>("/time-entries/active");
    return data;
  },

  clockIn: async (input: { userId?: string; shiftId?: string } = {}) => {
    const { data } = await api.post<TimeEntry>("/time-entries/clock-in", input);
    return data;
  },

  clockOut: async (): Promise<TimeEntry> => {
    const { data } = await api.post<TimeEntry>("/time-entries/clock-out", {});
    return data;
  },
};