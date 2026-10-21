import { create } from "zustand";
import {
  weeksApi,
  shiftsApi,
  type ScheduleWeek,
  type ScheduledShift,
  type ShiftUpdateResult,
} from "../api/weeks";

type State = {
  weeks: ScheduleWeek[];
  currentWeek: ScheduleWeek | null;
  loading: boolean;
  error: string | null;

  // ─── Недели ────────────────────────────────────────
  fetchWeeks: () => Promise<void>;
  fetchWeek: (id: string) => Promise<void>;
  createWeek: (weekStartDate: string) => Promise<ScheduleWeek>;
  publishWeek: (id: string) => Promise<{ ok: boolean; violations?: string[] }>;
  duplicateWeek: (id: string) => Promise<ScheduleWeek>;
  removeWeek: (id: string) => Promise<void>; // <-- НОВЫЙ МЕТОД

  // ─── Смены ─────────────────────────────────────────
  addShift: (input: {
    weekId: string;
    templateId?: string;
    userId?: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
  }) => Promise<ShiftUpdateResult>;

  updateShift: (
    id: string,
    input: Partial<{
      templateId: string | null;
      userId: string | null;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }>
  ) => Promise<ShiftUpdateResult>;

  removeShift: (id: string) => Promise<void>;
};

export const useWeeks = create<State>((set, get) => ({
  weeks: [],
  currentWeek: null,
  loading: false,
  error: null,

  // ══════════════════════════════════════════════════
  // НЕДЕЛИ
  // ══════════════════════════════════════════════════

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

  removeWeek: async (id) => {
    await weeksApi.remove(id);
    set((s) => ({
      weeks: s.weeks.filter((w) => w.id !== id),
      currentWeek: s.currentWeek?.id === id ? null : s.currentWeek,
    }));
  },

  // ══════════════════════════════════════════════════
  // СМЕНЫ
  // ══════════════════════════════════════════════════

  addShift: async (input) => {
    const result = await shiftsApi.create(input);

    if (result.kind === "applied") {
      const { currentWeek } = get();
      if (currentWeek && currentWeek.id === input.weekId) {
        set({
          currentWeek: {
            ...currentWeek,
            shifts: [...(currentWeek.shifts ?? []), result.shift],
          },
        });
      }
    }
    return result;
  },

  updateShift: async (id, input) => {
    const result = await shiftsApi.update(id, input);

    if (result.kind === "applied") {
      const { currentWeek } = get();
      if (currentWeek) {
        set({
          currentWeek: {
            ...currentWeek,
            shifts: (currentWeek.shifts ?? []).map((s) =>
              s.id === id ? result.shift : s
            ),
          },
        });
      }
    }
    return result;
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