import { api } from "./client";

export type PositionTemplate = {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdAt: string;
};

export const positionsApi = {
  list: async (): Promise<PositionTemplate[]> => {
    const { data } = await api.get<PositionTemplate[]>("/positions");
    return data;
  },
  create: async (input: { name: string; color?: string }): Promise<PositionTemplate> => {
    const { data } = await api.post<PositionTemplate>("/positions", input);
    return data;
  },
  update: async (
    id: string,
    input: { name?: string; color?: string }
  ): Promise<PositionTemplate> => {
    const { data } = await api.patch<PositionTemplate>(`/positions/${id}`, input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/positions/${id}`);
  },
};