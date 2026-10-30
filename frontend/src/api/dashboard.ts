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
  templateStartTime: string | null;
  templateEndTime: string | null;
  templateName: string | null;
  isNoShow: boolean;
  isUnknownAbsence: boolean;
};

export type DashboardSummary = {
  currentWeek: {
    id: string;
    weekStartDate: string;
    locationId: string;
    status: "DRAFT" | "PUBLISHED" | "LOCKED";
    shifts: ScheduledShift[];
  } | null;
  todayShifts: TodayShift[];
  weekTimeEntries: TimeEntry[];
  userCount: number;
  users: DashboardUser[];
  monthlyHours: number;
};

export const dashboardApi = {
  summary: async (locationId?: string, date?: string): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>("/dashboard", {
      params: { locationId, date },
    });
    return data;
  },
};