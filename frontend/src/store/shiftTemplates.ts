import { create } from "zustand";
import { shiftTemplatesApi } from "../api/shiftTemplates";
import type { ShiftTemplate } from "../api/types";

type State = {
  items: ShiftTemplate[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (input: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
  }) => Promise<void>;
  update: (
    id: string,
    input: Partial<{
      name: string;
      startTime: string;
      endTime: string;
      color: string;
    }>
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useShiftTemplates = create<State>((set) => ({
  items: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const items = await shiftTemplatesApi.list();
      set({ items, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка загрузки", loading: false });
    }
  },

  create: async (input) => {
    const created = await shiftTemplatesApi.create(input);
    set((s) => ({ items: [...s.items, created] }));
  },

  update: async (id, input) => {
    const updated = await shiftTemplatesApi.update(id, input);
    set((s) => ({
      items: s.items.map((t) => (t.id === id ? updated : t)),
    }));
  },

  remove: async (id) => {
    await shiftTemplatesApi.remove(id);
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));