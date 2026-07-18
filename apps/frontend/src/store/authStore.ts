import { create } from "zustand";

export interface Organization {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  organizations: Organization[];
  activeOrgId: string | null;
  setAuthenticated: (val: boolean) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setActiveOrg: (id: string) => void;
  getActiveOrg: () => Organization | undefined;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  organizations: [],
  activeOrgId: localStorage.getItem("activeOrgId"),
  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setOrganizations: (orgs) => {
  set({ organizations: orgs });
  const current = get().activeOrgId;
  const stillValid = current && orgs.some((o) => o.id === current);
  if (!stillValid && orgs.length > 0) {
    get().setActiveOrg(orgs[0].id);
  }
},
  setActiveOrg: (id) => {
    localStorage.setItem("activeOrgId", id);
    set({ activeOrgId: id });
  },
  getActiveOrg: () => get().organizations.find((o) => o.id === get().activeOrgId),
}));