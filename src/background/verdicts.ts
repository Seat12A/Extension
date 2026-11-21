import type { PublicVerdict } from "~/shared/api-types";
import { LIMITS } from "~/shared/constants";
import { errorCode, gateFetch, validIds } from "./api";
import { ttlGetMany, ttlSetMany } from "./store";
import { checkVerdictIndex } from "./verdict-index";

const KEY = "verdictCache";
const CONCURRENCY = 4;

/**
 * Verdicts of the posts on screen. `ids`: every displayed post; `filtered`: those that
 * pass the ingestion filters (all of `ids` when absent).
 *  - Verdict index served: only the posts listed in their bucket are looked up by id
 *    (the others never leave the device, only their 4-character bucket does).
 *  - Index not deployed yet (404): previous behaviour, filtered posts only.
 */
export async function getVerdicts(ids: string[], lang: string, filtered?: string[]): Promise<Record<string, PublicVerdict | null>> {
  const l = typeof lang === "string" && /^[a-z]{2,3}$/.test(lang) ? lang : "en";
  const valid = validIds(ids);
  const passed = new Set(filtered === undefined ? valid : validIds(filtered));
  const out: Record<string, PublicVerdict | null> = {};
  const cached = await ttlGetMany<PublicVerdict | null>("session", KEY, valid.map((id) => `${id}|${l}`), LIMITS.verdictCacheTtlMs);
  const unknown: string[] = [];
  for (const id of valid) {
    const k = `${id}|${l}`;
    if (cached.has(k)) out[id] = cached.get(k) ?? null;
    else { out[id] = null; unknown.push(id); }
  }
  const index = unknown.length ? await checkVerdictIndex(unknown) : { verified: [], missing: false };
  const misses = index.missing ? unknown.filter((id) => passed.has(id)) : index.verified;
  const toCache: Record<string, PublicVerdict | null> = {};
  let next = 0;
  const worker = async () => {
    while (next < misses.length) {
      const id = misses[next++]!;
      const res = await gateFetch(`/v1/content/x/${id}/verdict?lang=${l}`);
      if (res.status === 200 && res.body && typeof res.body === "object") {
        out[id] = res.body as PublicVerdict;
        toCache[`${id}|${l}`] = out[id];
      } else if (res.status === 404 && errorCode(res.body) === "TWR-FCK-013") {
        out[id] = null;
        toCache[`${id}|${l}`] = null;
      } else out[id] = null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, misses.length) }, worker));
  if (Object.keys(toCache).length) await ttlSetMany("session", KEY, toCache, LIMITS.verdictCacheMax);
  return out;
}
