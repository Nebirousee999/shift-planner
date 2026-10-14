import { create } from "zustand";
import { timeEntriesApi, type TimeEntry } from "../api/timeEntries";

type State = {
  items: TimeEntry[];
  active: TimeEntry | null;
  loading: boolean;
  error: string | null;

  fetch: (filters?: { userId?: string; from?: string; to?: string }) => Promise<void>;
  fetchActive: () => Promise<void>;
  clockIn: (input?: { userId?: string }) => Promise<void>;
  clockOut: () => Promise<void>;
};

export const useTimeEntries = create<State>((set, get) => ({
  items: [],
  active: null,
  loading: false,
  error: null,

  fetch: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const items = await timeEntriesApi.list(filters);
      set({ items, loading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.error ?? "Ошибка загрузки",
        loading: false,
      });
    }
  },

  fetchActive: async () => {
    try {
      const active = await timeEntriesApi.getActive();
      set({ active });
    } catch {
      set({ active: null });
    }
  },

  clockIn: async (input = {}) => {
    const entry = await timeEntriesApi.clockIn(input);
    set({ active: entry });
    // Обновим список, если он уже загружен
    const { items } = get();
    if (items.length > 0) {
      await get().fetch();
    }
  },

  clockOut: async () => {
    await timeEntriesApi.clockOut();
    set({ active: null });
    const { items } = get();
    if (items.length > 0) {
      await get().fetch();
    }
  },
}));