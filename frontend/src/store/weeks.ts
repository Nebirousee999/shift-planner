import { create } from "zustand";
import { weeksApi, shiftsApi, type ScheduleWeek, type ShiftUpdateResult,  } from "../api/weeks";

type State = {
  weeks: ScheduleWeek[];
  currentWeek: ScheduleWeek | null;
  loading: boolean;
  error: string | null;
  fetchWeeks: (locationId?: string) => Promise<void>;
  fetchWeek: (id: string) => Promise<void>;
  createWeek: (input: { weekStartDate: string; locationId: string }) => Promise<ScheduleWeek>;
  publishWeek: (id: string) => Promise<{ ok: boolean; week?: ScheduleWeek; violations?: string[] }>;
  unpublishWeek: (id: string) => Promise<ScheduleWeek>;
  duplicateWeek: (id: string) => Promise<ScheduleWeek>;
  removeWeek: (id: string) => Promise<void>;
  addShift: (input: Parameters<typeof shiftsApi.create>[0]) => Promise<ShiftUpdateResult>;
  updateShift: (id: string, patch: Parameters<typeof shiftsApi.update>[1]) => Promise<ShiftUpdateResult>;
  removeShift: (id: string) => Promise<void>;
};

export const useWeeks = create<State>((set, get) => ({
  weeks: [],
  currentWeek: null,
  loading: false,
  error: null,

  fetchWeeks: async (locationId?: string) => {
    set({ loading: true, error: null });
    try {
      const weeks = await weeksApi.list(locationId);
      set({ weeks, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка загрузки", loading: false });
    }
  },

  fetchWeek: async (id) => {
    set({ loading: true, error: null });
    try {
      const week = await weeksApi.get(id);
      set({ currentWeek: week, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка загрузки", loading: false });
    }
  },

  createWeek: async (input) => {
    const week = await weeksApi.create(input);
    set((s) => ({ weeks: [...s.weeks, week] }));
    return week;
  },

  publishWeek: async (id) => {
    try {
      const week = await weeksApi.publish(id);
      set((s) => ({
        weeks: s.weeks.map((w) => (w.id === id ? { ...w, ...week } : w)),
        currentWeek: s.currentWeek?.id === id ? { ...s.currentWeek, ...week } : s.currentWeek,
      }));
      return { ok: true, week };
    } catch (e: any) {
      if (e.response?.status === 422) {
        return { ok: false, violations: e.response.data?.violations ?? [] };
      }
      throw e;
    }
  },

  unpublishWeek: async (id) => {
    const week = await weeksApi.unpublish(id);
    set((s) => ({
      weeks: s.weeks.map((w) => (w.id === id ? { ...w, ...week } : w)),
      currentWeek: s.currentWeek?.id === id ? { ...s.currentWeek, ...week } : s.currentWeek,
    }));
    return week;
  },

  duplicateWeek: async (id) => {
    const week = await weeksApi.duplicate(id);
    set((s) => ({ weeks: [...s.weeks, week] }));
    return week;
  },

  removeWeek: async (id) => {
    await weeksApi.remove(id);
    set((s) => ({
      weeks: s.weeks.filter((w) => w.id !== id),
      currentWeek: s.currentWeek?.id === id ? null : s.currentWeek,
    }));
  },

  addShift: async (input) => {
    const result = await shiftsApi.create(input);
    if (result.kind === "applied") {
      await get().fetchWeek(input.weekId);
    }
    return result;
  },

  updateShift: async (id, patch) => {
    const result = await shiftsApi.update(id, patch);
    if (result.kind === "applied" && get().currentWeek) {
      await get().fetchWeek(get().currentWeek!.id);
    }
    return result;
  },

  removeShift: async (id) => {
    await shiftsApi.remove(id);
    if (get().currentWeek) await get().fetchWeek(get().currentWeek!.id);
  },
}));