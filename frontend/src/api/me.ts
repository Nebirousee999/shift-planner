import { api } from "./client";

export type MyProfile = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;
  hourlyRate: string | null;
  createdAt: string;
};

export type MyShift = {
  id: string;
  weekId: string;
  templateId: string | null;
  userId: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: string;
  templateName: string | null;
  weekStatus: "DRAFT" | "PUBLISHED" | "LOCKED" | null;
};

export type Colleague = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;
};

// ─── Мессенджеры и уведомления ─────────────────────
export type MessengerProvider = "telegram" | "max";

export type NotificationSettings = {
  newSchedule: boolean;
  shiftChanged: boolean;
  shiftCreated: boolean;
  shiftChangeApproval: boolean;
  swapRequest: boolean;
  vacationReviewed: boolean;
  sickLeave: boolean;
  timeOffReviewed: boolean;
  remindHour: boolean;
  remindFiveMin: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newSchedule: true,
  shiftChanged: true,
  shiftCreated: true,
  shiftChangeApproval: true,
  swapRequest: true,
  vacationReviewed: true,
  sickLeave: true,
  timeOffReviewed: true,
  remindHour: true,
  remindFiveMin: false,
};

export const meApi = {
  profile: async (): Promise<MyProfile> => {
    const { data } = await api.get<MyProfile>("/me");
    return data;
  },

  myShifts: async (filters: { from?: string; to?: string } = {}): Promise<MyShift[]> => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    const { data } = await api.get<MyShift[]>(`/me/shifts${qs ? "?" + qs : ""}`);
    return data;
  },

  colleagues: async (): Promise<Colleague[]> => {
    const { data } = await api.get<Colleague[]>("/me/colleagues");
    return data;
  },

  bindMessenger: async (input: {
    provider: MessengerProvider;
    externalId: string;
  }): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>(
      "/me/messengers/bind",
      input
    );
    return data;
  },

  testMessenger: async (): Promise<{ success: boolean }> => {
    const { data } = await api.get<{ success: boolean }>("/me/test-messenger");
    return data;
  },
};