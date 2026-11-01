import { api } from "./client";

export type Organization = {
  id: string;
  name: string;
  city: string | null;
  directorName: string | null;
  inn: string | null;
  legalAddress: string | null;
  timeTrackingEnabled: boolean;
  createdAt: string;
  overtimeMultiplier1?: string;
  overtimeMultiplier2?: string;
  maxLocations: number;
  positionHeaderOpacity: number;
  positionRowOpacity: number;
  taxRate: string;
  requireShiftApproval?: boolean;
  disciplineEditWindowDays?: number;
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
    timeTrackingEnabled?: boolean;
    overtimeMultiplier1?: string;
    overtimeMultiplier2?: string;
    maxLocations?: number;
    positionHeaderOpacity?: number;
    positionRowOpacity?: number;
    taxRate?: string;
  }): Promise<Organization> => {
    const { data } = await api.patch<Organization>("/organization", input);
    return data;
  },
};