// src/context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "dark" | "light" | "system" | "manni";
export type ResolvedTheme = "dark" | "light" | "manni";

interface ThemeContextType {
  theme: ResolvedTheme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "app-theme-preference";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system" || saved === "manni") {
      return saved as ThemePreference;
    }
    return "dark";
  });

  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(getSystemTheme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      setSystemTheme(mql.matches ? "light" : "dark");
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // "system" only ever resolves to light/dark — Manni Mode is always a
  // direct, explicit user choice (the OS has no "prefers-manni" signal),
  // so it passes through untouched here exactly like "light"/"dark" do.
  const theme: ResolvedTheme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);

      document.documentElement.classList.remove("light", "dark", "manni");
      document.documentElement.classList.add(theme);

      localStorage.setItem(STORAGE_KEY, themePreference);
    }
  }, [theme, themePreference]);

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
  };

  // Unchanged — still just flips between dark/light for any existing
  // callers of toggleTheme(); Manni Mode is only ever entered/left via
  // setThemePreference("manni") / setThemePreference(<something else>)
  // from the Settings screen, never via this toggle.
  const toggleTheme = () => {
    setThemePreferenceState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      themePreference,
      setThemePreference,
      toggleTheme,
    }),
    [theme, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      themePreference: "dark",
      setThemePreference: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}