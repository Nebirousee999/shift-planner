import { api } from "./client";

export type Ticket = {
  id: string;
  email: string;
  message: string;
  reply: string | null;
  status: string;
  createdAt: string;
};

export const supportApi = {
  create: async (data: { email: string; message: string; images?: string[] }) => {
    const { data: res } = await api.post("/support", data);
    return res;
  },
  my: async (): Promise<Ticket[]> => {
    const { data } = await api.get<Ticket[]>("/support/my");
    return data;
  },
};
