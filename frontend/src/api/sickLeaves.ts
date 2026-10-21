import { api } from "./client";

export type SickLeave = {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  comment: string | null;
};

export const sickLeavesApi = {
  list: async () => { const { data } = await api.get<SickLeave[]>("/sick-leaves"); return data; },
  create: async (input: { userId: string; startDate: string; endDate: string; comment?: string }) => {
    const { data } = await api.post<SickLeave>("/sick-leaves", input); return data;
  },
  remove: async (id: string) => { await api.delete(`/sick-leaves/${id}`); },
};