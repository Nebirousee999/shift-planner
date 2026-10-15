import { create } from "zustand";
import {
  organizationApi,
  type Organization,
} from "../api/organization";

type State = {
  org: Organization | null;
  loading: boolean;
  fetch: () => Promise<void>;
  set: (o: Organization) => void;
};

export const useOrganization = create<State>((set) => ({
  org: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const org = await organizationApi.get();
      set({ org, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  set: (o) => set({ org: o }),
}));