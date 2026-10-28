import { api } from "./client";

export type Area = {
  id: string;
  orgId: string;
  locationId: string;
  name: string;
  createdAt: string;
};

export const areasApi = {
  list: async (locationId?: string): Promise<Area[]> => {
    const { data } = await api.get<Area[]>("/areas", {
      params: locationId ? { locationId } : {},
    });
    return data;
  },
  create: async (input: { locationId: string; name: string }): Promise<Area> => {
    const { data } = await api.post<Area>("/areas", input);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/areas/${id}`);
  },
  copy: async (input: {
    areaIds: string[];
    targetLocationId: string;
  }): Promise<{ copied: number; skipped: number }> => {
    const { data } = await api.post<{ copied: number; skipped: number }>(
      "/areas/copy",
      input
    );
    return data;
  },
};