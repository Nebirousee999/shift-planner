import { create } from "zustand";
import { positionsApi, type PositionTemplate } from "../api/positions";

type State = {
  items: PositionTemplate[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (input: { name: string; color?: string }) => Promise<PositionTemplate>;
  update: (id: string, input: { name?: string; color?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePositions = create<State>((set) => ({
  items: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const items = await positionsApi.list();
      set({ items, loading: false });
    } catch { set({ loading: false }); }
  },
  create: async (input) => {
    const created = await positionsApi.create(input);
    set((s) => ({
      items: [...s.items.filter((p) => p.id !== created.id), created].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));
    return created;
  },
  update: async (id, input) => {
    const updated = await positionsApi.update(id, input);
    set((s) => ({
      items: s.items
        .map((p) => (p.id === id ? updated : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },
  remove: async (id) => {
    await positionsApi.remove(id);
    set((s) => ({ items: s.items.filter((p) => p.id !== id) }));
  },
}));