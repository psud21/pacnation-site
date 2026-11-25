import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "pn-theme";

const stored = (): Theme | null => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // storage blocked (private mode, previews)
  }
};
const system = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/**
 * Light/dark switch. The theme starts from a saved choice, else the device
 * setting (applied before first paint by index.html); until the person picks
 * one, it keeps following the device.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || stored() || system());

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => { if (!stored()) setTheme(system()); };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const choose = () => {
    setTheme(next);
    try { localStorage.setItem(KEY, next); } catch { /* the choice just won't persist */ }
  };

  return (
    <button className="theme-toggle" onClick={choose} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? (
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="10" y1="2.2" x2="10" y2="4.2" transform={`rotate(${a} 10 10)`} />)}</g></svg>
      ) : (
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" fill="currentColor" /></svg>
      )}
    </button>
  );
}
