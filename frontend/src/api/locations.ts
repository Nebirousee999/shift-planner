import { api } from "./client";

export type Location = {
  id: string;
  orgId: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isArchived: boolean;
  createdAt: string;
};

export type LocationEmployee = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;
};

export const locationsApi = {
  list: async (): Promise<Location[]> => {
    const { data } = await api.get<Location[]>("/locations");
    return data;
  },
  create: async (input: { name: string; address?: string; city?: string; phone?: string }): Promise<Location> => {
    const { data } = await api.post<Location>("/locations", input);
    return data;
  },
  update: async (
    id: string,
    input: Partial<{ name: string; address: string | null; city: string | null; phone: string | null }>
  ): Promise<Location> => {
    const { data } = await api.patch<Location>(`/locations/${id}`, input);
    return data;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/locations/${id}`);
  },
  getEmployees: async (id: string): Promise<LocationEmployee[]> => {
    const { data } = await api.get<LocationEmployee[]>(`/locations/${id}/employees`);
    return data;
  },
  setEmployees: async (id: string, userIds: string[]): Promise<void> => {
    await api.put(`/locations/${id}/employees`, { userIds });
  },
};