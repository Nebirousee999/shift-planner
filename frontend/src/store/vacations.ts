import { create } from "zustand";
import { vacationsApi, type Vacation } from "../api/vacations";

type State = {
  all: Vacation[];
  mine: Vacation[];
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  fetchMine: () => Promise<void>;
  create: (input: {
    userId?: string;
    startDate: string;
    endDate: string;
    comment?: string;
  }) => Promise<void>;
  update: (
    id: string,
    input: Partial<{
      startDate: string;
      endDate: string;
      comment: string | null;
    }>
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useVacations = create<State>((set, get) => ({
  all: [],
  mine: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const all = await vacationsApi.list();
      set({ all, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка", loading: false });
    }
  },

  fetchMine: async () => {
    try {
      const mine = await vacationsApi.mine();
      set({ mine });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка" });
    }
  },

  create: async (input) => {
    await vacationsApi.create(input);
    await Promise.all([get().fetchAll(), get().fetchMine()]);
  },

  update: async (id, input) => {
    await vacationsApi.update(id, input);
    await Promise.all([get().fetchAll(), get().fetchMine()]);
  },

  remove: async (id) => {
    await vacationsApi.remove(id);
    await Promise.all([get().fetchAll(), get().fetchMine()]);
  },
}));