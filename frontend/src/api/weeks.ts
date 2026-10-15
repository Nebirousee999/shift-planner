import { api } from "./client";

// ─── Типы ─────────────────────────────────────────────
export type ScheduledShift = {
  id: string;
  weekId: string;
  templateId: string | null;
  userId: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt?: string;
};

export type ScheduleWeek = {
  id: string;
  orgId: string;
  weekStartDate: string;
  status: "DRAFT" | "PUBLISHED" | "LOCKED";
  publishedAt: string | null;
  createdAt: string;
  shifts?: ScheduledShift[];
};

export type LimitCheck = {
  currentHours: number;
  newShiftHours: number;
  totalHours: number;
  limit: number;
  exceeds: boolean;
  excess: number;
  userName: string;
};

export type OverlapCheck = {
  overlaps: boolean;
  userName: string;
  conflicting: { id: string; startTime: string; endTime: string }[];
};

// Результат создания/обновления смены:
//   applied   — применилось сразу (DRAFT или согласовывать некому)
//   requested — создан запрос на согласование (PUBLISHED)
export type ShiftUpdateResult =
  | { kind: "applied"; shift: ScheduledShift }
  | { kind: "requested"; request: any };

// ─── API недель ───────────────────────────────────────
export const weeksApi = {
  list: async (): Promise<ScheduleWeek[]> => {
    const { data } = await api.get<ScheduleWeek[]>("/schedule-weeks");
    return data;
  },

  get: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.get<ScheduleWeek>(`/schedule-weeks/${id}`);
    return data;
  },

  create: async (input: { weekStartDate: string }): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>("/schedule-weeks", input);
    return data;
  },

  publish: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>(
      `/schedule-weeks/${id}/publish`
    );
    return data;
  },

  duplicate: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>(
      `/schedule-weeks/${id}/duplicate`
    );
    return data;
  },
};

// ─── API смен ─────────────────────────────────────────
export const shiftsApi = {
  /**
   * Создание смены.
   * Возвращает либо применённую смену, либо запрос на согласование
   * (если неделя PUBLISHED и есть кому согласовывать).
   */
  create: async (input: {
    weekId: string;
    templateId?: string;
    userId?: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
  }): Promise<ShiftUpdateResult> => {
    const { data } = await api.post<ShiftUpdateResult>(
      "/scheduled-shifts",
      input
    );
    return data;
  },

  /**
   * Обновление смены.
   * Возвращает:
   *   - { kind: "applied", shift } — смена изменена сразу
   *   - { kind: "requested", request } — создан запрос на согласование
   */
  update: async (
    id: string,
    input: Partial<{
      templateId: string | null;
      userId: string | null;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }>
  ): Promise<ShiftUpdateResult> => {
    const { data } = await api.patch<ShiftUpdateResult>(
      `/scheduled-shifts/${id}`,
      input
    );
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/scheduled-shifts/${id}`);
  },

  checkLimits: async (params: {
    userId: string;
    weekId: string;
    startTime: string;
    endTime: string;
    excludeShiftId?: string;
  }): Promise<LimitCheck> => {
    const { data } = await api.get<LimitCheck>(
      "/scheduled-shifts/check-limits",
      { params }
    );
    return data;
  },

  checkOverlap: async (params: {
    userId: string;
    weekId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    excludeShiftId?: string;
  }): Promise<OverlapCheck> => {
    const { data } = await api.get<OverlapCheck>(
      "/scheduled-shifts/check-overlap",
      { params }
    );
    return data;
  },
};