import { create } from "zustand";
import { sickLeavesApi, type SickLeave } from "../api/sickLeaves";

type State = {
  all: SickLeave[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  create: (input: any) => Promise<void>;
  update: (id: string, input: { startDate?: string; endDate?: string; comment?: string | null }) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useSickLeaves = create<State>((set, get) => ({
  all: [],
  loading: false,
  fetchAll: async () => {
    set({ loading: true });
    try { const all = await sickLeavesApi.list(); set({ all, loading: false }); }
    catch { set({ loading: false }); }
  },
  create: async (input) => { await sickLeavesApi.create(input); await get().fetchAll(); },
  update: async (id, input) => { await sickLeavesApi.update(id, input); await get().fetchAll(); },
  remove: async (id) => { await sickLeavesApi.remove(id); await get().fetchAll(); },
}));