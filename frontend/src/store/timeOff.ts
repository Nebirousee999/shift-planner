import { create } from "zustand";
import { timeOffApi } from "../api/timeOff";

export const useTimeOff = create<{ items: any[]; loading: boolean; fetch: () => Promise<void>; approve: (id: string) => Promise<void>; reject: (id: string) => Promise<void>; }>((set, get) => ({
  items: [], loading: false,
  fetch: async () => {
    set({ loading: true });
    try { set({ items: await timeOffApi.list(), loading: false }); } catch { set({ loading: false }); }
  },
  approve: async (id) => { await timeOffApi.approve(id); await get().fetch(); },
  reject: async (id) => { await timeOffApi.reject(id); await get().fetch(); },
}));