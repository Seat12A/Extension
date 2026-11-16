/** Parses location.hash of the form `#tab` or `#tab?key=value&k2=v2`. */
export const OPTIONS_TABS = ["general", "privacy", "request", "report", "about"] as const;
export type OptionsTab = (typeof OPTIONS_TABS)[number];

export interface ParsedHash { tab: OptionsTab; params: Record<string, string> }

export function parseHash(hash: string, fallback: OptionsTab = "general"): ParsedHash {
  const raw = hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const name = q === -1 ? raw : raw.slice(0, q);
  const params: Record<string, string> = {};
  if (q !== -1) for (const [k, v] of new URLSearchParams(raw.slice(q + 1))) params[k] = v;
  const tab = (OPTIONS_TABS as readonly string[]).includes(name) ? (name as OptionsTab) : fallback;
  return { tab, params };
}

export function buildHash(tab: OptionsTab): string {
  return `#${tab}`;
}
