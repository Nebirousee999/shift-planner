import { api } from "./client";
export type SickLeave = {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  status?: "APPROVED";
  createdAt: string;
  updatedAt: string | null;              // ← null, если не редактировали
  createdById: string | null;
  updatedById: string | null;
  createdByName: string | null;
  updatedByName: string | null;
};

export const sickLeavesApi = {
  list: async () => {
    const { data } = await api.get<SickLeave[]>("/sick-leaves");
    return data;
  },
  mine: async () => {
    const { data } = await api.get<SickLeave[]>("/sick-leaves/mine");
    return data;
  },
  create: async (input: { userId: string; startDate: string; endDate: string; comment?: string }) => {
    const { data } = await api.post<SickLeave>("/sick-leaves", input);
    return data;
  },
  update: async (
    id: string,
    input: Partial<{ startDate: string; endDate: string; comment: string | null }>
  ) => {
    const { data } = await api.patch<SickLeave>(`/sick-leaves/${id}`, input);
    return data;
  },
  remove: async (id: string) => { await api.delete(`/sick-leaves/${id}`); },
};