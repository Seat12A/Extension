import type { IngestConfig, ObservationMetrics } from "~/shared/api-types";
import { matchesKeyword, normalizeText } from "~/shared/text";

export interface FilterInput { text: string; metrics?: ObservationMetrics }

const THRESHOLD_KEYS: Record<string, keyof ObservationMetrics> = {
  min_views: "views", min_likes: "likes", min_reposts: "reposts", min_replies: "replies",
};

/**
 * Does a post pass the server-provided filters? Only posts that pass are ever
 * sent anywhere (observations) or looked up (verdicts).
 *
 * Match: ANY keyword matches the normalised text, OR the author's numeric id is in
 * `filters.accounts` (platform x).
 * Thresholds (PROVISIONAL semantics, to confirm with Tower): `min_views|likes|reposts|replies`
 * require `metrics[x] >= value`; a missing metric fails; unknown keys are ignored.
 */
export function passesFilters(post: FilterInput, config: IngestConfig | null | undefined, authorId?: string): boolean {
  if (!config || config.version == null) return false;
  const { keywords, accounts, thresholds } = config.filters;
  let matched = false;
  if (authorId && accounts.some((a) => a.platform === "x" && a.external_id === authorId)) matched = true;
  if (!matched && keywords.length > 0) {
    const norm = normalizeText(post.text);
    matched = keywords.some((k) => matchesKeyword(norm, k));
  }
  if (!matched) return false;
  for (const [key, value] of Object.entries(thresholds ?? {})) {
    const metric = THRESHOLD_KEYS[key];
    if (!metric) continue;
    const v = post.metrics?.[metric];
    if (v === undefined || v < value) return false;
  }
  return true;
}
