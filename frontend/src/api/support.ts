import { api } from "./client";

export type SupportMessage = {
  id: string;
  sender: "USER" | "ADMIN";
  text: string;
  images: string[] | null;
  createdAt: string;
};

export type AdminTicket = {
  id: string;
  email: string;
  userId: string | null;
  isRegistered: boolean;
  tariffId: string | null;
  status: string;
  lastMessage: string;
  hasUnread: boolean;
  createdAt: string;
};

export const supportApi = {
  send: async (data: { email: string; message: string; images?: string[]; sessionToken?: string }) => {
    const { data: res } = await api.post("/support", data);
    return res;
  },
  getMessages: async (sessionToken: string): Promise<SupportMessage[]> => {
    if (!sessionToken) return [];
    const { data } = await api.get<SupportMessage[]>("/support/messages", { params: { sessionToken } });
    return data;
  },
  adminGetTickets: async (): Promise<AdminTicket[]> => {
    const { data } = await api.get<AdminTicket[]>("/support/admin/tickets");
    return data;
  },
  adminGetMessages: async (ticketId: string): Promise<SupportMessage[]> => {
    const { data } = await api.get<SupportMessage[]>(`/support/admin/tickets/${ticketId}/messages`);
    return data;
  },
  adminReply: async (ticketId: string, text: string) => {
    const { data } = await api.post(`/support/admin/tickets/${ticketId}/reply`, { text });
    return data;
  }
};
