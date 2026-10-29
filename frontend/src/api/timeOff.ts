import { api } from "./client";
export const timeOffApi = {
  list: async () => (await api.get("/time-off")).data,
  create: async (input: { shiftId: string; date: string; comment?: string }) => (await api.post("/time-off", input)).data,
  approve: async (id: string) => (await api.post(`/time-off/${id}/approve`, {})).data,
  reject: async (id: string) => (await api.post(`/time-off/${id}/reject`, {})).data,
};