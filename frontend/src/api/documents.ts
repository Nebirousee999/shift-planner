import { api } from "./client";

export type DocumentField = {
  name: string;
  label: string;
  type: "text" | "date" | "textarea" | "employee_select";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

export type DocumentType = {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: DocumentField[];
};

export type GeneratedDocument = {
  id: string;
  orgId: string;
  userId: string | null;
  type: string;
  title: string;
  params: Record<string, any>;
  createdAt: string;
};

export const documentsApi = {
  listTemplates: async (): Promise<DocumentType[]> => {
    const { data } = await api.get<DocumentType[]>("/documents/templates");
    return data;
  },

  listGenerated: async (): Promise<GeneratedDocument[]> => {
    const { data } = await api.get<GeneratedDocument[]>("/documents");
    return data;
  },

  generate: async (
    type: string,
    params: Record<string, any>
  ): Promise<GeneratedDocument> => {
    const { data } = await api.post<GeneratedDocument>("/documents/generate", {
      type,
      params,
    });
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  download: async (id: string, filename: string): Promise<void> => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `http://localhost:3001/api/documents/${id}/download`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) throw new Error("Ошибка скачивания");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  preview: async (
    type: string,
    params: Record<string, any>
  ): Promise<Blob> => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}/documents/preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, params }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Ошибка превью"
      );
    }
    return res.blob();
  },
};