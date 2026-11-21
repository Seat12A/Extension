/**
 * Colours of in-page UI (badges and verdicts). Badge colours follow the contrast
 * table chosen by the design team (light / dark variants). The API also sends a
 * `color`: it is used only for categories this table does not know yet, so a new
 * server-side category still renders without a client release.
 */
import type { BadgeCategory, Veracity } from "./api-types";

export type PageTheme = "light" | "dim" | "dark";

export interface BadgeColors { fill: string; stroke?: string }

const BADGE: Record<string, { light: BadgeColors; dark: BadgeColors }> = {
  institutional: { light: { fill: "#F46600" }, dark: { fill: "#FF6A00" } },
  // Deep gold: the white check needs ≥ 3:1 (WCAG 1.4.11). Bright yellow (#FFBF00) gave 1.6:1.
  organization: { light: { fill: "#A87A00" }, dark: { fill: "#A87A00" } },
  media: { light: { fill: "#EA00FF" }, dark: { fill: "#EE33FF" } },
  expert: { light: { fill: "#00A0C0" }, dark: { fill: "#00D4FF" } },
  personality: { light: { fill: "#335CFF" }, dark: { fill: "#6D8AFF" } },
};

export const KNOWN_BADGE_CATEGORIES = Object.keys(BADGE) as BadgeCategory[];

/** Colour of the badge for `category` on a page in `theme`; `apiColor` for unknown categories. */
export function badgeColors(category: BadgeCategory, theme: PageTheme, apiColor?: string): BadgeColors {
  const known = BADGE[category];
  if (known) return theme === "light" ? known.light : known.dark;
  return { fill: apiColor && /^#[0-9a-f]{6}$/i.test(apiColor) ? apiColor : "#667b99" };
}

/** Verdict tones. Text colour meets WCAG AA on the matching tinted background. */
export interface Tone { fg: string; bg: string; border: string }
const VERACITY: Record<string, { light: Tone; dark: Tone }> = {
  true: { light: { fg: "#067647", bg: "#ecfdf3", border: "#abefc6" }, dark: { fg: "#75e0a7", bg: "#053321", border: "#085d3a" } },
  mostly_true: { light: { fg: "#0e7090", bg: "#ecfdff", border: "#a5f0fc" }, dark: { fg: "#67e3f9", bg: "#0b2b36", border: "#155b75" } },
  misleading: { light: { fg: "#b54708", bg: "#fffaeb", border: "#fedf89" }, dark: { fg: "#fec84b", bg: "#3a2506", border: "#7a4510" } },
  false: { light: { fg: "#b42318", bg: "#fef3f2", border: "#fecdca" }, dark: { fg: "#fda29b", bg: "#3d1311", border: "#7a271a" } },
  unverifiable: { light: { fg: "#405168", bg: "#f9fafb", border: "#dce2ea" }, dark: { fg: "#aebbc9", bg: "#1e2936", border: "#2e4052" } },
};

export function veracityTone(v: Veracity, theme: PageTheme): Tone {
  const t = VERACITY[v] ?? VERACITY.unverifiable!;
  return theme === "light" ? t.light : t.dark;
}

/** Severity order used to pick the summary badge of a post with several claims. */
export const VERACITY_SEVERITY: Veracity[] = ["false", "misleading", "unverifiable", "mostly_true", "true"];
