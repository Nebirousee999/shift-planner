import { api } from "./client";

export type SwapRequest = {
  id: string;
  shiftId: string;
  requestedBy: string;
  swapWithUserId: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: string;
  requestedByName?: string;
  swapWithName?: string | null;
  shiftDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  templateId?: string | null;  // ← НОВОЕ
};

export const swapsApi = {
  list: async (): Promise<SwapRequest[]> => {
    const { data } = await api.get<SwapRequest[]>("/swaps");
    return data;
  },

  outgoing: async (): Promise<SwapRequest[]> => {
    const { data } = await api.get<SwapRequest[]>("/swaps/outgoing");
    return data;
  },

  incoming: async (): Promise<SwapRequest[]> => {
    const { data } = await api.get<SwapRequest[]>("/swaps/incoming");
    return data;
  },

  incomingCount: async (): Promise<number> => {
    const { data } = await api.get<{ count: number }>("/swaps/incoming/count");
    return data.count;
  },

  create: async (input: {
    shiftId: string;
    swapWithUserId?: string;
  }): Promise<SwapRequest> => {
    const { data } = await api.post<SwapRequest>("/swaps", input);
    return data;
  },

  accept: async (id: string): Promise<SwapRequest> => {
    const { data } = await api.post<SwapRequest>(`/swaps/${id}/accept`, {});
    return data;
  },

  decline: async (id: string): Promise<SwapRequest> => {
    const { data } = await api.post<SwapRequest>(`/swaps/${id}/decline`, {});
    return data;
  },

  cancel: async (id: string): Promise<void> => {
    await api.delete(`/swaps/${id}`);
  },
};