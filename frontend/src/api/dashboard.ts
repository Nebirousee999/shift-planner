import { api } from "./client";

export type DashboardSummary = {
  userCount: number;
  templateCount: number;
  weekStats: {
    total: number;
    draft: number;
    published: number;
  };
  nextWeek: {
    id: string;
    weekStartDate: string;
    status: "DRAFT" | "PUBLISHED" | "LOCKED";
    shiftsCount: number;
  } | null;
  workingNow: Array<{
    entryId: string;
    userId: string;
    userName: string;
    clockIn: string;
  }>;
  monthlyHours: number;
};

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> => {
    const { data } = await api.get<DashboardSummary>("/dashboard");
    return data;
  },
};