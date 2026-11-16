/**
 * User settings, stored in chrome.storage.local under `settings` (never synced:
 * nothing about the user leaves the device). Readable from any extension context,
 * including the content script, without going through the service worker.
 */
import type { Lang } from "./constants";

export type LanguagePref = "auto" | Lang;
export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  /** Send filtered posts to Tower. Verdicts and badges keep working when off. */
  sendObservations: boolean;
  /** Show validated fact-checks under filtered posts. */
  showVerdicts: boolean;
  /** Hide X checkmarks and show Seat 12A badges. */
  showBadges: boolean;
  language: LanguagePref;
  /** Theme of popup and options. In-page UI follows X's own theme. */
  theme: ThemePref;
}

export const DEFAULT_SETTINGS: Settings = {
  sendObservations: true,
  showVerdicts: true,
  showBadges: true,
  language: "auto",
  theme: "system",
};

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const raw = (await chrome.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

/** Calls `cb` whenever settings change (any context). Returns an unsubscribe function. */
export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes[KEY]) cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue ?? {}) });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
