import { create } from "zustand";
import { swapsApi, type SwapRequest } from "../api/swaps";

type State = {
  all: SwapRequest[];
  outgoing: SwapRequest[];
  incoming: SwapRequest[];
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  fetchMine: () => Promise<void>;
  create: (input: { shiftId: string; swapWithUserId?: string }) => Promise<void>;
  accept: (id: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
};

export const useSwaps = create<State>((set, get) => ({
  all: [],
  outgoing: [],
  incoming: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const all = await swapsApi.list();
      set({ all, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка", loading: false });
    }
  },

  fetchMine: async () => {
    try {
      const [outgoing, incoming] = await Promise.all([
        swapsApi.outgoing(),
        swapsApi.incoming(),
      ]);
      set({ outgoing, incoming });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка" });
    }
  },

  create: async (input) => {
    await swapsApi.create(input);
    await get().fetchMine();
  },

  accept: async (id) => {
    await swapsApi.accept(id);
    await Promise.all([get().fetchAll(), get().fetchMine()]);
  },

  decline: async (id) => {
    await swapsApi.decline(id);
    await Promise.all([get().fetchAll(), get().fetchMine()]);
  },

  cancel: async (id) => {
    await swapsApi.cancel(id);
    await get().fetchMine();
  },
}));