import { create } from "zustand";

interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

function applyThemeClass(theme: "dark" | "light") {
  document.documentElement.classList.toggle("light", theme === "light");
}

const stored = (localStorage.getItem("atlas-theme") as "dark" | "light") || "dark";
applyThemeClass(stored);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: stored,
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("atlas-theme", next);
    applyThemeClass(next);
    set({ theme: next });
  },
}));