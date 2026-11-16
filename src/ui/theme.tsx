/** Applies data-theme="light"|"dark" on <html> from settings.theme ("system" follows the OS live). */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSettings, onSettingsChanged, type ThemePref } from "~/shared/settings";

export type ResolvedTheme = "light" | "dark";
const QUERY = "(prefers-color-scheme: dark)";

function systemDark(): boolean {
  try { return globalThis.matchMedia?.(QUERY).matches ?? false; } catch { return false; }
}
export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? (systemDark() ? "dark" : "light") : pref;
}
export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Call before first render to avoid a flash of the wrong theme. */
export async function applyStoredTheme(): Promise<void> {
  try { applyTheme(resolveTheme((await getSettings()).theme)); } catch { applyTheme(resolveTheme("system")); }
}

const ThemeContext = createContext<ResolvedTheme>("light");
export const useResolvedTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>("system");
  const [dark, setDark] = useState(systemDark);
  useEffect(() => {
    let alive = true;
    void getSettings().then((s) => alive && setPref(s.theme));
    const off = onSettingsChanged((s) => setPref(s.theme));
    return () => { alive = false; off(); };
  }, []);
  useEffect(() => {
    const mq = globalThis.matchMedia?.(QUERY);
    if (!mq) return;
    const on = () => setDark(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const theme: ResolvedTheme = pref === "system" ? (dark ? "dark" : "light") : pref;
  useEffect(() => { applyTheme(theme); }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
