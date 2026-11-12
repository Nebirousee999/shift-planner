import { api } from "./client";

export type DbUserInfo = {
  id: string;
  orgName: string;
  email: string;
  createdAt: string;
  tariff: string;
  expiresAt: string | null;
  employeeCount: number;
};

export const adminApi = {
  getDatabase: async (): Promise<DbUserInfo[]> => {
    const { data } = await api.get<DbUserInfo[]>("/admin/db-info");
    return data;
  },
};
