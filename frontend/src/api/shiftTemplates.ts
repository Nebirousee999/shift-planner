import { api } from "./client";
import type { ShiftTemplate } from "./types";

export const shiftTemplatesApi = {
  list: async (): Promise<ShiftTemplate[]> => {
    const { data } = await api.get<ShiftTemplate[]>("/shift-templates");
    return data;
  },

  create: async (input: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
  }): Promise<ShiftTemplate> => {
    const { data } = await api.post<ShiftTemplate>("/shift-templates", input);
    return data;
  },

  update: async (
    id: string,
    input: Partial<{
      name: string;
      startTime: string;
      endTime: string;
      color: string;
    }>
  ): Promise<ShiftTemplate> => {
    const { data } = await api.patch<ShiftTemplate>(
      `/shift-templates/${id}`,
      input
    );
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/shift-templates/${id}`);
  },
};