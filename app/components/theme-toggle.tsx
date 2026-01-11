"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("rentapp:theme") as Theme | null;
    setTheme(stored || "system");
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const storageKey = "rentapp:theme";

    if (theme === "system") {
      localStorage.removeItem(storageKey);
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      localStorage.setItem(storageKey, theme);
      root.setAttribute("data-theme", theme);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-foreground/15 bg-background/60 backdrop-blur" />
    );
  }

  const cycleTheme = () => {
    setTheme((current) => {
      if (current === "dark") return "light";
      if (current === "light") return "system";
      return "dark";
    });
  };

  return (
    <button
      onClick={cycleTheme}
      className="group relative h-9 w-9 rounded-lg border border-foreground/15 bg-background/60 backdrop-blur transition-all hover:border-foreground/30 hover:bg-background/80 active:scale-95"
      title={`Tema: ${
        theme === "system"
          ? "sistem"
          : theme === "dark"
          ? "întunecată"
          : "luminoasă"
      }`}
    >
      {/* Dark mode icon */}
      {theme === "dark" && (
        <svg
          className="absolute inset-0 m-auto h-5 w-5 text-foreground/80 transition-transform group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}

      {/* Light mode icon */}
      {theme === "light" && (
        <svg
          className="absolute inset-0 m-auto h-5 w-5 text-foreground/80 transition-transform group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}

      {/* System mode icon */}
      {theme === "system" && (
        <svg
          className="absolute inset-0 m-auto h-5 w-5 text-foreground/80 transition-transform group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
