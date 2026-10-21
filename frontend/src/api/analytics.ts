import { api } from "./client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export type MomStat = {
  hours: number;
  shifts: number;
  payroll: number;
  actualPayroll: number;
  avgCost: number;
};

export type WeekdayStat = {
  weekday: number;
  label: string;
  shifts: number;
  plannedHours: number;
  payroll: number;
};

export type PositionStat = {
  position: string;
  shifts: number;
  plannedHours: number;
  payroll: number;
  percent: number;
};

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
};

export type AnalyticsSummary = {
  period: { from: string; to: string };
  prevPeriod: { from: string; to: string };
  totals: {
    hours: number;
    shifts: number;
    payroll: number;
    actualPayroll: number;
    overtimeCost: number;
    avgCost: number;
    mom: MomStat;
  };
  users: AnalyticsUser[];
  planVsFact: { plannedHours: number; actualHours: number; diffPercent: number };
  byWeekday: WeekdayStat[];
  byPosition: PositionStat[];
};

async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    let msg = "Ошибка скачивания";
    try {
      const data = await res.json();
      msg = data.details ? `${data.error}: ${data.details}` : data.error ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  let filename = fallbackName;
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (m) {
    try { filename = decodeURIComponent(m[1]); } catch { /* ignore */ }
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export const analyticsApi = {
  summary: async (from: string, to: string, locationId?: string): Promise<AnalyticsSummary> => {
    const { data } = await api.get<AnalyticsSummary>("/analytics", {
      params: { from, to, ...(locationId ? { locationId } : {}) },
    });
    return data;
  },
  downloadExcel: async (from: string, to: string, locationId?: string): Promise<void> => {
    const q = locationId ? `&locationId=${locationId}` : "";
    await downloadFile(
      `${API_URL}/analytics/export/excel?from=${from}&to=${to}${q}`,
      `Аналитика_${from}_${to}.xlsx`
    );
  },
  downloadPdf: async (from: string, to: string, locationId?: string): Promise<void> => {
    const q = locationId ? `&locationId=${locationId}` : "";
    await downloadFile(
      `${API_URL}/analytics/export/pdf?from=${from}&to=${to}${q}`,
      `Аналитика_${from}_${to}.pdf`
    );
  },
};