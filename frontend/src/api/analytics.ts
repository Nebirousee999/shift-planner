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

export type OvertimeUser = {
  userId: string;
  name: string;
  hourlyRate: number;
  plannedHours: number;
  actualHours: number;
  overtimeHours: number;
  overtimePay: number;
};

export type OvertimeSummary = {
  period: { from: string; to: string };
  settings: { mult1: number; mult2: number };
  users: OvertimeUser[];
};


export const analyticsApi = {
  summary: async (from: string, to: string): Promise<AnalyticsSummary> => {
    const { data } = await api.get<AnalyticsSummary>("/analytics", {
      params: { from, to },
    });
    return data;
  },

  getOvertime: async (from: string, to: string): Promise<OvertimeSummary> => {
    const { data } = await api.get<OvertimeSummary>("/analytics/overtime", {
      params: { from, to },
    });
    return data;
  },

};