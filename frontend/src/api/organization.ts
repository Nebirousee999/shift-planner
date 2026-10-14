import { api } from "./client";

export type Organization = {
  id: string;
  name: string;
  city: string | null;
  directorName: string | null;
  inn: string | null;
  legalAddress: string | null;
  createdAt: string;
};

export const organizationApi = {
  get: async (): Promise<Organization> => {
    const { data } = await api.get<Organization>("/organization");
    return data;
  },

  update: async (input: {
    name?: string;
    city?: string | null;
    directorName?: string | null;
    inn?: string | null;
    legalAddress?: string | null;
  }): Promise<Organization> => {
    const { data } = await api.patch<Organization>("/organization", input);
    return data;
  },
};