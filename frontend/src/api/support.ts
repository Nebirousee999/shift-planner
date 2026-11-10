import { api } from "./client";

export type SupportMessage = {
  id: string;
  sender: "USER" | "ADMIN";
  text: string;
  images: string[] | null;
  createdAt: string;
};

export const supportApi = {
  send: async (data: { email: string; message: string; images?: string[]; sessionToken?: string }) => {
    const { data: res } = await api.post("/support", data);
    return res;
  },
  getMessages: async (sessionToken: string): Promise<SupportMessage[]> => {
    if (!sessionToken) return [];
    const { data } = await api.get<SupportMessage[]>("/support/messages", {
      params: { sessionToken },
    });
    return data;
  },
};
