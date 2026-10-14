import { create } from "zustand";
import {
  documentsApi,
  type DocumentType,
  type GeneratedDocument,
} from "../api/documents";

type State = {
  templates: DocumentType[];
  generated: GeneratedDocument[];
  loading: boolean;
  error: string | null;

  fetchTemplates: () => Promise<void>;
  fetchGenerated: () => Promise<void>;
  generate: (type: string, params: Record<string, any>) => Promise<GeneratedDocument>;
  remove: (id: string) => Promise<void>;
  download: (id: string, filename: string) => Promise<void>;
};

export const useDocuments = create<State>((set) => ({
  templates: [],
  generated: [],
  loading: false,
  error: null,

  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await documentsApi.listTemplates();
      set({ templates, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка загрузки", loading: false });
    }
  },

  fetchGenerated: async () => {
    try {
      const generated = await documentsApi.listGenerated();
      set({ generated });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? "Ошибка загрузки" });
    }
  },

  generate: async (type, params) => {
    const doc = await documentsApi.generate(type, params);
    set((s) => ({ generated: [doc, ...s.generated] }));
    return doc;
  },

  remove: async (id) => {
    await documentsApi.remove(id);
    set((s) => ({ generated: s.generated.filter((d) => d.id !== id) }));
  },

  download: async (id, filename) => {
    await documentsApi.download(id, filename);
  },
}));