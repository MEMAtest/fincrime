"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "fincrime-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    readDomTheme,
    () => "light" as Theme,
  );

  // On first client mount, ensure the DOM theme matches the user's stored preference.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored) {
        if (stored !== readDomTheme()) applyTheme(stored);
      } else {
        // Dark-canonical: default to dark on first visit
        applyTheme("dark");
      }
    } catch {
      // localStorage unavailable — dark-canonical fallback
      applyTheme("dark");
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readDomTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: "light" as Theme, toggleTheme: () => {}, setTheme: () => {} };
  }
  return ctx;
}
