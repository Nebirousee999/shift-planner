import { api } from "./client";

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;
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
    position?: string;
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
      position: string | null;
      hourlyRate: string | null;
    }>
  ): Promise<TeamUser> => {
    const { data } = await api.patch<TeamUser>(`/users/${id}`, input);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // ─── Импорт из Excel ────────────────────────────────
  downloadExcelTemplate: async (): Promise<void> => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}/users/excel-template`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Ошибка скачивания шаблона");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Шаблон_Сотрудники.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importFromExcel: async (
    file: File
  ): Promise<{
    created: number;
    skipped: number;
    errors: string[];
    createdUsers: Array<{ name: string; email: string; tempPassword: string }>;
  }> => {
    const base64 = await fileToBase64(file);
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}/users/import`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileBase64: base64 }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Ошибка импорта"
      );
    }
    return res.json();
  },
};

// ─── Хелпер: файл → base64 ──────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}