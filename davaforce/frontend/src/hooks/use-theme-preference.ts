"use client";

import { useEffect, useState } from "react";

type ThemeName = "light" | "dark";

const themeStorageKey = "workforceTheme";
const themeTransitionClassName = "theme-switching";
const themeTransitionDurationMs = 280;
let themeTransitionTimeoutId: number | null = null;
let themeTransitionFrameId: number | null = null;

function getSystemTheme(): ThemeName {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemeName | null {
  if (typeof window === "undefined") return null;
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
}

function getPreferredTheme(): ThemeName {
  return readStoredTheme() ?? getSystemTheme();
}

function applyThemeToDocument(nextTheme: ThemeName) {
  if (typeof document === "undefined") return;

  const isDark = nextTheme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
}

function startThemeTransition() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.add(themeTransitionClassName);
  void root.getBoundingClientRect();

  if (themeTransitionTimeoutId !== null) {
    window.clearTimeout(themeTransitionTimeoutId);
  }

  themeTransitionTimeoutId = window.setTimeout(() => {
    root.classList.remove(themeTransitionClassName);
    themeTransitionTimeoutId = null;
  }, themeTransitionDurationMs);
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemeName>(() => getPreferredTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => setThemeState(getPreferredTheme());

    applyTheme();
    media.addEventListener("change", applyTheme);
    window.addEventListener("storage", applyTheme);

    return () => {
      media.removeEventListener("change", applyTheme);
      window.removeEventListener("storage", applyTheme);
    };
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = (nextTheme: ThemeName) => {
    if (nextTheme === theme) return;

    startThemeTransition();
    window.localStorage.setItem(themeStorageKey, nextTheme);

    if (themeTransitionFrameId !== null) {
      window.cancelAnimationFrame(themeTransitionFrameId);
    }

    themeTransitionFrameId = window.requestAnimationFrame(() => {
      applyThemeToDocument(nextTheme);
      setThemeState(nextTheme);
      themeTransitionFrameId = null;
    });
  };

  const isDarkMode = theme === "dark";

  return {
    isDarkMode,
    theme,
    toggleTheme: () => setTheme(isDarkMode ? "light" : "dark"),
  };
}
