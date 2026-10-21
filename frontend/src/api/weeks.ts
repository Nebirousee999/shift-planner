import { api } from "./client";

export type ScheduledShift = {
  id: string;
  weekId: string;
  templateId: string | null;
  userId: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: string;
  latenessMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  createdAt?: string;
};

export type ScheduleWeek = {
  id: string;
  orgId: string;
  locationId: string;
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

export type ShiftUpdateResult =
  | { kind: "applied"; shift: ScheduledShift }
  | { kind: "requested"; request: any };

export const weeksApi = {
  list: async (locationId?: string): Promise<ScheduleWeek[]> => {
    const { data } = await api.get<ScheduleWeek[]>("/schedule-weeks", {
      params: locationId ? { locationId } : {},
    });
    return data;
  },
  get: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.get<ScheduleWeek>(`/schedule-weeks/${id}`);
    return data;
  },
  create: async (input: { weekStartDate: string; locationId: string }): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>("/schedule-weeks", input);
    return data;
  },
  publish: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>(`/schedule-weeks/${id}/publish`);
    return data;
  },
  duplicate: async (id: string): Promise<ScheduleWeek> => {
    const { data } = await api.post<ScheduleWeek>(`/schedule-weeks/${id}/duplicate`);
    return data;
  },
  remove: async (id: string) => {
    await api.delete(`/schedule-weeks/${id}`);
  },
};

export const shiftsApi = {
  create: async (input: {
    weekId: string;
    templateId?: string;
    userId?: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
  }): Promise<ShiftUpdateResult> => {
    const { data } = await api.post<ShiftUpdateResult>("/scheduled-shifts", input);
    return data;
  },
  update: async (
    id: string,
    input: Partial<{
      templateId: string | null;
      userId: string | null;
      shiftDate: string;
      startTime: string;
      endTime: string;
      latenessMinutes: number;
      earlyLeaveMinutes: number;
      overtimeMinutes: number;
    }>
  ): Promise<ShiftUpdateResult> => {
    const { data } = await api.patch<ShiftUpdateResult>(`/scheduled-shifts/${id}`, input);
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
    const { data } = await api.get<LimitCheck>("/scheduled-shifts/check-limits", { params });
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
    const { data } = await api.get<OverlapCheck>("/scheduled-shifts/check-overlap", { params });
    return data;
  },
};