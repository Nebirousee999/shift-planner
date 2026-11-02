import { api } from "./client";

export type CurrentSubscription = {
  tariffId: "free" | "pro" | "business";
  tariffExpiresAt: string | null;
  isActive: boolean;
  daysLeft: number | null;
  maxLocations: number;
  hasAnyPayment: boolean;
};

export type Payment = {
  id: string;
  userId: string;
  yookassaId: string;
  amount: string;
  status: string;
  description: string;
  metadata: any;
  createdAt: string;
  updatedAt: string | null;
};

export const paymentsApi = {
  current: async (): Promise<CurrentSubscription> => {
    const { data } = await api.get<CurrentSubscription>("/payments/current");
    return data;
  },
  history: async (): Promise<Payment[]> => {
    const { data } = await api.get<Payment[]>("/payments/history");
    return data;
  },
  create: async (tariffId: "pro" | "business", amount: number, description: string) => {
    const { data } = await api.post<{ paymentId: string; confirmationUrl: string }>(
      "/payments/create",
      { tariffId, amount, description }
    );
    return data;
  },
};
