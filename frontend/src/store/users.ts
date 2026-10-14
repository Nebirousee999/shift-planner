import { create } from "zustand";
import { usersApi, type TeamUser } from "../api/users";

type State = {
  items: TeamUser[];
  loading: boolean;
  error: string | null;

  fetch: () => Promise<void>;

  create: (input: {
    name: string;
    email: string;
    password?: string;
    role?: "OWNER" | "MANAGER" | "EMPLOYEE";
    position?: string;
    hourlyRate?: string;
    phone?: string;
  }) => Promise<{ tempPassword?: string }>;

  update: (
    id: string,
    input: Partial<{
      name: string;
      phone: string | null;
      role: "OWNER" | "MANAGER" | "EMPLOYEE";
      position: string | null;
      hourlyRate: string | null;
    }>
  ) => Promise<void>;

  remove: (id: string) => Promise<void>;

  downloadExcelTemplate: () => Promise<void>;

  importFromExcel: (file: File) => Promise<{
    created: number;
    skipped: number;
    errors: string[];
    createdUsers: Array<{ name: string; email: string; tempPassword: string }>;
  }>;
};

export const useUsers = create<State>((set) => ({
  items: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const items = await usersApi.list();
      set({ items, loading: false });
    } catch (e: any) {
      set({
        error: e.response?.data?.error ?? "Ошибка загрузки",
        loading: false,
      });
    }
  },

  create: async (input) => {
    const result = await usersApi.create(input);
    set((s) => ({ items: [...s.items, result.user] }));
    return { tempPassword: result.tempPassword };
  },

  update: async (id, input) => {
    const updated = await usersApi.update(id, input);
    set((s) => ({
      items: s.items.map((u) => (u.id === id ? updated : u)),
    }));
  },

  remove: async (id) => {
    await usersApi.remove(id);
    set((s) => ({ items: s.items.filter((u) => u.id !== id) }));
  },

  downloadExcelTemplate: async () => {
    await usersApi.downloadExcelTemplate();
  },

  importFromExcel: async (file) => {
    const result = await usersApi.importFromExcel(file);
    // Перезагружаем список сотрудников
    const items = await usersApi.list();
    set({ items });
    return result;
  },
}));