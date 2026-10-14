import { create } from "zustand";
import {
  weeksApi,
  shiftsApi,
  type ScheduleWeek,
  type ScheduledShift,
} from "../api/weeks";

type State = {
  weeks: ScheduleWeek[];
  currentWeek: ScheduleWeek | null;
  loading: boolean;
  error: string | null;

  // Недели
  fetchWeeks: () => Promise<void>;
  fetchWeek: (id: string) => Promise<void>;
  createWeek: (weekStartDate: string) => Promise<ScheduleWeek>;
  publishWeek: (id: string) => Promise<{ ok: boolean; violations?: string[] }>;
  duplicateWeek: (id: string) => Promise<ScheduleWeek>;

  // Смены
  addShift: (input: {
    weekId: string;
    templateId?: string;
    userId?: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  updateShift: (
    id: string,
    input: Partial<{
      templateId: string | null;
      userId: string | null;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }>
  ) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
};

export const useWeeks = create<State>((set, get) => ({
  weeks: [],
  currentWeek: null,
  loading: false,
  error: null,

  // ─── Недели ─────────────────────────────────────────
  fetchWeeks: async () => {
    set({ loading: true, error: null });
    try {
      const weeks = await weeksApi.list();
      set({ weeks, loading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.error ?? "Ошибка загрузки",
        loading: false,
      });
    }
  },

  fetchWeek: async (id) => {
    set({ loading: true, error: null });
    try {
      const week = await weeksApi.get(id);
      set({ currentWeek: week, loading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.error ?? "Ошибка загрузки",
        loading: false,
      });
    }
  },

  createWeek: async (weekStartDate) => {
    const week = await weeksApi.create({ weekStartDate });
    set((s) => ({ weeks: [...s.weeks, week] }));
    return week;
  },

  publishWeek: async (id) => {
    try {
      const updated = await weeksApi.publish(id);
      set((s) => ({
        weeks: s.weeks.map((w) => (w.id === id ? updated : w)),
        currentWeek:
          s.currentWeek?.id === id
            ? { ...s.currentWeek, ...updated }
            : s.currentWeek,
      }));
      return { ok: true };
    } catch (e: any) {
      if (e.response?.status === 422) {
        return { ok: false, violations: e.response.data.violations ?? [] };
      }
      throw e;
    }
  },

  duplicateWeek: async (id) => {
    const week = await weeksApi.duplicate(id);
    set((s) => ({ weeks: [...s.weeks, week] }));
    return week;
  },

  // ─── Смены ──────────────────────────────────────────
  addShift: async (input) => {
    const shift = await shiftsApi.create(input);
    const { currentWeek } = get();
    if (currentWeek && currentWeek.id === input.weekId) {
      set({
        currentWeek: {
          ...currentWeek,
          shifts: [...(currentWeek.shifts ?? []), shift],
        },
      });
    }
  },

  updateShift: async (id, input) => {
    const updated = await shiftsApi.update(id, input);
    const { currentWeek } = get();
    if (currentWeek) {
      set({
        currentWeek: {
          ...currentWeek,
          shifts: (currentWeek.shifts ?? []).map((s) =>
            s.id === id ? updated : s
          ),
        },
      });
    }
  },

  removeShift: async (id) => {
    await shiftsApi.remove(id);
    const { currentWeek } = get();
    if (currentWeek) {
      set({
        currentWeek: {
          ...currentWeek,
          shifts: (currentWeek.shifts ?? []).filter((s) => s.id !== id),
        },
      });
    }
  },
}));