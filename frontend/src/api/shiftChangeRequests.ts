import { api } from "./client";

export type ShiftChangeRequest = {
  id: string;
  shiftId: string | null;
  kind: "UPDATE" | "CREATE";
  weekId?: string | null;
  templateId?: string | null;
  requestedBy: string;
  targetUserId: string;
  oldShiftDate: string;
  oldStartTime: string;
  oldEndTime: string;
  oldUserId: string | null;
  newShiftDate: string;
  newStartTime: string;
  newEndTime: string;
  newUserId: string | null;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByName?: string;
  targetUserName?: string;
  oldUserName?: string | null;
  newUserName?: string | null;
  createdAt: string;
};

export const shiftChangeRequestsApi = {
  list: async (): Promise<ShiftChangeRequest[]> => {
    const res = await api.get("/shift-change-requests");
    return res.data;
  },

  incoming: async (): Promise<ShiftChangeRequest[]> => {
    const res = await api.get("/shift-change-requests/incoming");
    return res.data;
  },

  incomingCount: async (): Promise<number> => {
    const res = await api.get("/shift-change-requests/incoming/count");
    return res.data.count ?? 0;
  },

  outgoing: async (): Promise<ShiftChangeRequest[]> => {
    const res = await api.get("/shift-change-requests/outgoing");
    return res.data;
  },

  approve: async (id: string): Promise<void> => {
    await api.post(`/shift-change-requests/${id}/approve`, {});
  },

  reject: async (id: string): Promise<void> => {
    await api.post(`/shift-change-requests/${id}/reject`, {});
  },

  cancel: async (id: string): Promise<void> => {
    await api.delete(`/shift-change-requests/${id}`);
  },
};
