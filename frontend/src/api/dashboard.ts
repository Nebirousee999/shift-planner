import { api } from "./client";
import type { ScheduledShift } from "./weeks";

export type TimeEntry = {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
};

export type TodayShift = {
  id: string;
  startTime: string;
  endTime: string;
  userId: string | null;
  userName: string | null;
  userPosition: string | null;
  templateId: string | null;
  templateColor: string | null;
};

export type ShiftChangeRequest = {
  id: string;
  shiftId: string;
  oldEndTime: string;
  newEndTime: string;
  // ... другие поля, если нужны
};


export type DashboardSummary = {
  currentWeek: {
    id: string;
    weekStartDate: string;
    status: "DRAFT" | "PUBLISHED" | "LOCKED";
    shifts: ScheduledShift[];
  } | null;
  todayShifts: TodayShift[];
  weekTimeEntries: TimeEntry[]; // <--- Новое поле
  userCount: number;
  monthlyHours: number;
  weekShiftChanges: ShiftChangeRequest[]; // 👈
};






export const dashboardApi = {
  summary: async (date?: string): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>("/dashboard", {
      params: date ? { date } : undefined,
    });
    return data;
  },
};