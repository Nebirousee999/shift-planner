import { api } from "./client";

export type UserStat = {
  userId: string;
  name: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  hourlyRate: number | null;
  shiftsCount: number;
  plannedHours: number;
  actualHours: number;
  payroll: number;
};

export type AnalyticsSummary = {
  period: { from: string; to: string };
  totals: { hours: number; shifts: number; payroll: number };
  users: UserStat[];
  planVsFact: {
    plannedHours: number;
    actualHours: number;
    diffPercent: number;
  };
};

export const analyticsApi = {
  summary: async (from: string, to: string): Promise<AnalyticsSummary> => {
    const { data } = await api.get<AnalyticsSummary>("/analytics", {
      params: { from, to },
    });
    return data;
  },
};