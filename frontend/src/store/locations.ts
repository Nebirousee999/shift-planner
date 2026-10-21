import { create } from "zustand";
import { locationsApi, type Location } from "../api/locations";

type State = {
  items: Location[];
  activeLocationId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  setActive: (id: string | null) => void;
  create: (input: { name: string; address?: string; city?: string; phone?: string }) => Promise<Location>;
  update: (id: string, input: Partial<{ name: string; address: string | null; city: string | null; phone: string | null }>) => Promise<Location>;
  archive: (id: string) => Promise<void>;
};

const ACTIVE_KEY = "activeLocationId";

export const useLocations = create<State>((set, get) => ({
  items: [],
  activeLocationId: localStorage.getItem(ACTIVE_KEY),
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const items = await locationsApi.list();
      set({ items, loading: false });
      const active = get().activeLocationId;
      if ((!active || !items.find((l) => l.id === active)) && items.length > 0) {
        set({ activeLocationId: items[0].id });
        localStorage.setItem(ACTIVE_KEY, items[0].id);
      }
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setActive: (id) => {
    set({ activeLocationId: id });
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  },

  create: async (input) => {
    const loc = await locationsApi.create(input);
    set((s) => ({ items: [...s.items, loc] }));
    return loc;
  },

  update: async (id, input) => {
    const updated = await locationsApi.update(id, input);
    set((s) => ({ items: s.items.map((l) => (l.id === id ? updated : l)) }));
    return updated;
  },

  archive: async (id) => {
    await locationsApi.archive(id);
    set((s) => ({ items: s.items.filter((l) => l.id !== id) }));
    const active = get().activeLocationId;
    if (active === id) {
      const next = get().items[0]?.id ?? null;
      get().setActive(next);
    }
  },
}));