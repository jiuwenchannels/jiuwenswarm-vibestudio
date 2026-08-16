/**
 * Theme store — persists the user's dark/light preference to localStorage
 * and keeps the `dark` class on <html> in sync.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

function applyClass(dark: boolean): void {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Detect the OS preference as the initial default (no stored preference).
const systemPrefersDark =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: systemPrefersDark,

      toggle: () =>
        set((s) => {
          const next = !s.isDark;
          applyClass(next);
          return { isDark: next };
        }),

      setDark: (dark: boolean) =>
        set(() => {
          applyClass(dark);
          return { isDark: dark };
        }),
    }),
    {
      name: "vs-theme",
      // Re-apply the class whenever the store is rehydrated from localStorage.
      onRehydrateStorage: () => (state) => {
        if (state) applyClass(state.isDark);
      },
    },
  ),
);
