import { api } from "./client";

export type Vacation = {
  id: string;
  orgId: string;
  userId: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  previousStartDate: string | null;
  previousEndDate: string | null;
  previousComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  userName?: string;
};

export const vacationsApi = {
  list: async (): Promise<Vacation[]> => {
    const { data } = await api.get<Vacation[]>("/vacations");
    return data;
  },

  mine: async (): Promise<Vacation[]> => {
    const { data } = await api.get<Vacation[]>("/vacations/mine");
    return data;
  },

  listPending: async (): Promise<Vacation[]> => {
    const { data } = await api.get<Vacation[]>("/vacations/pending");
    return data;
  },

  pendingCount: async (): Promise<number> => {
    const { data } = await api.get<{ count: number }>(
      "/vacations/pending/count"
    );
    return data.count;
  },

  check: async (
    userId: string,
    date: string
  ): Promise<{ onVacation: boolean; vacation: Vacation | null }> => {
    const { data } = await api.get("/vacations/check", {
      params: { userId, date },
    });
    return data;
  },

  create: async (input: {
    userId?: string;
    startDate: string;
    endDate: string;
    comment?: string;
  }): Promise<Vacation> => {
    const { data } = await api.post<Vacation>("/vacations", input);
    return data;
  },

  update: async (
    id: string,
    input: Partial<{
      startDate: string;
      endDate: string;
      comment: string | null;
    }>
  ): Promise<Vacation> => {
    const { data } = await api.patch<Vacation>(`/vacations/${id}`, input);
    return data;
  },

  approve: async (id: string): Promise<Vacation> => {
    const { data } = await api.post<Vacation>(`/vacations/${id}/approve`, {});
    return data;
  },

  reject: async (id: string): Promise<Vacation> => {
    const { data } = await api.post<Vacation>(`/vacations/${id}/reject`, {});
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/vacations/${id}`);
  },
};