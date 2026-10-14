import { api } from "./client";

export type MyProfile = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;       // ← НОВОЕ
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

};

export type Colleague = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;       // ← НОВОЕ
};