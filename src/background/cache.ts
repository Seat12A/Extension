/**
 * "Reload" from the popup: forget every cached server answer so the next lookups hit
 * Tower again (a badge or verdict validated a minute ago shows up at once).
 * Kept: settings, installation token, send queue, dedupe and quota state, government
 * hints already sent (a rate-limit memory, not a display cache).
 */
import { CACHE_EPOCH_KEY } from "~/shared/constants";
import { bypassHttpCache } from "./api";
import { refreshCategories } from "./badges";
import { forceRefreshConfig } from "./config";

const SESSION_KEYS = [
  "verdictCache", "badgeCache2", "lookupEtags2", "accountDetailCache2", "authorIds",
  "badgeCache", "lookupEtags", "accountDetailCache", // pre-2026-11-21 keys
];
const LOCAL_KEYS = ["badgeCategories"];
/** Browser HTTP cache (Tower sends max-age=300) bypassed for this long after a reload. */
const BYPASS_MS = 2 * 60_000;

export async function clearCaches(): Promise<{ ok: true }> {
  await chrome.storage.session.remove(SESSION_KEYS);
  await chrome.storage.local.remove(LOCAL_KEYS);
  bypassHttpCache(BYPASS_MS);
  await Promise.all([forceRefreshConfig(), refreshCategories()]);
  // Tells every open x.com tab to drop its in-memory state and redraw.
  await chrome.storage.local.set({ [CACHE_EPOCH_KEY]: Date.now() });
  return { ok: true };
}
