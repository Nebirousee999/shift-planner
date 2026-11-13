import { api } from "./client";

export type AdminUserInfo = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  orgName: string;
  createdAt: string;
};

export const adminApi = {
  getDatabase: async (): Promise<AdminUserInfo[]> => {
    const { data } = await api.get<AdminUserInfo[]>("/admin/db-info");
    return data;
  },
  deleteUsers: async (userIds: string[]) => {
    const { data } = await api.delete("/admin/users", { data: { userIds } });
    return data;
  }
};
