import { api } from "./client";
import type { ScheduledShift } from "./weeks";

export type DashboardUser = {
  id: string;
  name: string;
  hourlyRate: string | null;
  position: string | null;
};

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
  latenessMinutes?: number;
  earlyLeaveMinutes?: number;
  templateStartTime: string | null; // <--- ДОБАВИТЬ
  templateEndTime: string | null;   // <--- ДОБАВИТЬ
};

export type DashboardSummary = {
  currentWeek: {
    id: string;
    weekStartDate: string;
    status: "DRAFT" | "PUBLISHED" | "LOCKED";
    shifts: ScheduledShift[];
  } | null;
  todayShifts: TodayShift[];
  weekTimeEntries: TimeEntry[];
  userCount: number;
  users: DashboardUser[]; // <--- Добавили это поле
  monthlyHours: number;
};

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>("/dashboard");
    return data;
  },
};