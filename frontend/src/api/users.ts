import { api } from "./client";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  hourlyRate: string | null;
  createdAt: string;
};

export const usersApi = {
  list: async (): Promise<TeamUser[]> => {
    const { data } = await api.get<TeamUser[]>("/users");
    return data;
  },

  create: async (input: {
    name: string;
    email: string;
    password?: string;
    role?: "OWNER" | "MANAGER" | "EMPLOYEE";
    hourlyRate?: string;
    phone?: string;
  }): Promise<{ user: TeamUser; tempPassword?: string }> => {
    const { data } = await api.post("/users", input);
    return data;
  },

  update: async (
    id: string,
    input: Partial<{
      name: string;
      phone: string | null;
      role: "OWNER" | "MANAGER" | "EMPLOYEE";
      hourlyRate: string | null;
    }>
  ): Promise<TeamUser> => {
    const { data } = await api.patch<TeamUser>(`/users/${id}`, input);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};