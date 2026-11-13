import { create } from "zustand";
import { areasApi, type Area } from "../api/areas";

type State = {
  items: Area[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (input: { locationId: string; name: string }) => Promise<Area>;
  update: (id: string, input: { name: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  copy: (input: {
    areaIds: string[];
    targetLocationId: string;
  }) => Promise<{ copied: number; skipped: number }>;
};

export const useAreas = create<State>((set, get) => ({
  items: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const items = await areasApi.list();
      set({ items, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  create: async (input) => {
    const created = await areasApi.create(input);
    set((s) => {
      // 👇 если сервер вернул существующую — не добавляем дубль
      if (s.items.some((a) => a.id === created.id)) return s;
      return {
        items: [...s.items, created].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
    return created;
  },

  update: async (id, input) => {
    const updated = await areasApi.update(id, input);
    set((s) => ({
      items: s.items.map((a) => (a.id === id ? updated : a)),
    }));
  },

  remove: async (id) => {
    await areasApi.remove(id);
    set((s) => ({ items: s.items.filter((a) => a.id !== id) }));
  },

  copy: async (input) => {
    const result = await areasApi.copy(input);
    await get().fetch();
    return result;
  },
}));