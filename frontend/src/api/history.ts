import { api } from "./client";
export const historyApi = {
  list: async (params: { from?: string; to?: string; type?: string }) => {
    const { data } = await api.get("/history", { params });
    return data;
  },
};