import { api } from "./client";

export type AnalyticsUser = {
  userId: string;
  name: string;
  role: string;
  hourlyRate: number | null;
  shiftsCount: number;
  plannedHours: number;
  actualHours: number;
  plannedPayroll: number;
  actualPayroll: number;
  overtimeHours: number;
  overtimeCost: number;
  avgCost: number;
};

export type AnalyticsSummary = {
  period: { from: string; to: string };
  totals: {
    hours: number;
    shifts: number;
    payroll: number;
    actualPayroll: number;
    overtimeCost: number;
  };
  users: AnalyticsUser[];
  planVsFact: {
    plannedHours: number;
    actualHours: number;
    diffPercent: number;
  };
};

export const analyticsApi = {
  summary: async (from: string, to: string) => {
    const { data } = await api.get<AnalyticsSummary>("/analytics", {
      params: { from, to },
    });
    return data;
  },
};