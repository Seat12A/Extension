import type { BadgeAccount, BadgeAccountDetail, BadgeAffiliation, BadgeCategoryInfo, BadgeOwn } from "~/shared/api-types";
import { ALARMS, LIMITS } from "~/shared/constants";
import { normalizeCategory } from "~/shared/palette";
import { gateFetch, validIds } from "./api";
import { getLocal, setLocal, ttlGet, ttlGetMany, ttlSetMany } from "./store";

// v2: lookup shape of 2026-11-21 (badge and affiliation independent). Old entries are never read.
const BADGE_KEY = "badgeCache2";
const ETAG_KEY = "lookupEtags2";
const ETAG_MAX = 200;
const ETAG_TTL = 24 * 60 * 60_000;
const DETAIL_KEY = "accountDetailCache2";
const DETAIL_TTL = 5 * 60_000;
const DETAIL_MAX = 200;
const CATS_KEY = "badgeCategories";
const HINTS_KEY = "govHints";
const HINTS_MAX = 5000;

const byIdOrder = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);

interface EtagEntry { etag: string; body: { accounts?: Record<string, unknown> } }

export async function lookupBadges(ids: string[]): Promise<Record<string, BadgeAccount | null>> {
  const valid = validIds(ids);
  const out: Record<string, BadgeAccount | null> = {};
  const cached = await ttlGetMany<BadgeAccount | null>("session", BADGE_KEY, valid, LIMITS.badgeCacheTtlMs);
  const misses: string[] = [];
  for (const id of valid) {
    if (cached.has(id)) out[id] = cached.get(id) ?? null;
    else misses.push(id);
  }
  misses.sort(byIdOrder);
  for (let i = 0; i < misses.length; i += LIMITS.badgeLookupMaxIds) {
    const chunk = misses.slice(i, i + LIMITS.badgeLookupMaxIds);
    const url = `/v1/badges/lookup?platform=x&ids=${chunk.join(",")}`;
    const prev = (await ttlGet<EtagEntry>("session", ETAG_KEY, url, ETAG_TTL))?.v;
    const res = await gateFetch(url, { headers: prev?.etag ? { "If-None-Match": prev.etag } : {} });
    let body: EtagEntry["body"] | null = null;
    if (res.status === 200 && res.body && typeof res.body === "object") {
      body = res.body;
      const etag = res.headers.get("ETag");
      if (etag) await ttlSetMany("session", ETAG_KEY, { [url]: { etag, body } }, ETAG_MAX);
    } else if (res.status === 304 && prev) body = prev.body;
    if (!body || typeof body.accounts !== "object" || !body.accounts) {
      for (const id of chunk) out[id] = null; // error: not cached
      continue;
    }
    const entries: Record<string, BadgeAccount | null> = {};
    for (const id of chunk) {
      const acc = Object.hasOwn(body.accounts, id) ? normalizeBadgeAccount(body.accounts[id]) : null;
      entries[id] = acc;
      out[id] = entries[id]!;
    }
    await ttlSetMany("session", BADGE_KEY, entries, LIMITS.badgeCacheMax);
  }
  return out;
}

// ---- categories -----------------------------------------------------------------
interface StoredCats { fetchedAt: number; items: BadgeCategoryInfo[] }
const sortCats = (items: BadgeCategoryInfo[]) => [...items].sort((a, b) => a.rank - b.rank);

export async function refreshCategories(): Promise<BadgeCategoryInfo[] | null> {
  const res = await gateFetch("/v1/badges/categories");
  if (res.status !== 200) return null;
  const b = res.body;
  const items: unknown = Array.isArray(b) ? b : b?.items ?? b?.categories;
  if (!Array.isArray(items)) return null;
  await setLocal(CATS_KEY, { fetchedAt: Date.now(), items } satisfies StoredCats);
  return items as BadgeCategoryInfo[];
}

export async function getBadgeCategories(): Promise<BadgeCategoryInfo[]> {
  const stored = await getLocal<StoredCats | null>(CATS_KEY, null);
  if (stored && Date.now() - stored.fetchedAt <= LIMITS.categoriesTtlMs) return sortCats(stored.items);
  const fresh = await refreshCategories();
  return sortCats(fresh ?? stored?.items ?? []);
}

export async function ensureCategoriesAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(ALARMS.categories))) chrome.alarms.create(ALARMS.categories, { periodInMinutes: 1440 });
}

// ---- account detail -------------------------------------------------------------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

const active = (o: Obj) => o.status === undefined || o.status === "active";

function normalizeAffiliation(a: unknown): BadgeAffiliation | null {
  if (!isObj(a)) return null;
  const org = isObj(a.org) ? a.org : isObj(a.organization) ? a.organization : {};
  if (!active(org)) return null;
  const label = str(org.label) ?? str(org.name) ?? str(a.org_label) ?? str(a.label);
  if (!label) return null;
  return {
    org: {
      platform: "x",
      external_id: str(org.external_id) ?? (isObj(org.account) ? str(org.account.external_id) : undefined),
      label,
      logo_url: str(org.logo_url) ?? str(a.logo_url) ?? null,
      category: normalizeCategory(str(org.category)) ?? null,
      color: str(org.color) ?? null,
    },
    title: str(a.title) ?? null,
  };
}

function normalizeBadge(b: unknown): BadgeOwn | null {
  if (!isObj(b) || !active(b) || !str(b.category)) return null;
  return {
    category: normalizeCategory(str(b.category)!),
    color: str(b.color) ?? "",
    label: str(b.label) ?? null,
    expertise: str(b.expertise)?.slice(0, 120) ?? null,
  };
}

/**
 * One account, from the lookup or the detail endpoint (Tower, 2026-11-21):
 *  - the check comes ONLY from the account's own `badge`; `category`/`color` mirror it;
 *  - affiliations are independent (main one first: `affiliation`, else `primary: true`), ≤ 5;
 *  - `personality` is read as `verified`.
 * A body without any `badge` key but with a top-level category (older flat shape) still
 * yields a badge; `badge: null` never does. Returns null when nothing can be displayed.
 */
export function normalizeBadgeAccount(body: unknown): BadgeAccount | null {
  if (!isObj(body)) return null;
  let badge = normalizeBadge(body.badge);
  if (!badge && !("badge" in body) && str(body.category)) badge = normalizeBadge({ category: body.category, color: body.color });
  const raw = (Array.isArray(body.affiliations) ? body.affiliations : []) as unknown[];
  const sorted = [...raw].sort((x, y) => Number(isObj(y) && y.primary === true) - Number(isObj(x) && x.primary === true));
  const list = sorted.map(normalizeAffiliation).filter((a): a is BadgeAffiliation => !!a);
  const main = normalizeAffiliation(body.affiliation) ?? list[0] ?? null;
  const affiliations = main
    ? [main, ...list.filter((a) => !(a.org.label === main.org.label && a.org.external_id === main.org.external_id))]
    : list;
  if (!badge && !main) return null;
  return { category: badge?.category ?? null, color: badge?.color ?? null, badge, affiliation: main, affiliations: affiliations.slice(0, 5) };
}

/** `GET /v1/badges/accounts/{platform}/{id}`: `{account, badge, affiliations[]}` → `BadgeAccountDetail`. */
export function normalizeAccountDetail(body: unknown, id: string): BadgeAccountDetail | null {
  const acc = normalizeBadgeAccount(body);
  if (!acc || !isObj(body)) return null;
  const account = isObj(body.account) ? body.account : {};
  return { platform: "x", external_id: str(account.external_id) ?? str(body.external_id) ?? id, ...acc };
}

export async function getAccountDetail(id: string): Promise<BadgeAccountDetail | null> {
  if (typeof id !== "string" || !/^\d{1,19}$/.test(id)) return null;
  const hit = await ttlGet<BadgeAccountDetail>("session", DETAIL_KEY, id, DETAIL_TTL);
  if (hit) return hit.v;
  const res = await gateFetch(`/v1/badges/accounts/x/${id}`);
  if (res.status !== 200) return null;
  const detail = normalizeAccountDetail(res.body, id);
  if (!detail) return null;
  await ttlSetMany("session", DETAIL_KEY, { [id]: detail }, DETAIL_MAX);
  return detail;
}

// ---- government hints -----------------------------------------------------------
export async function sendGovernmentHints(ids: string[]): Promise<{ queued: number }> {
  const valid = validIds(ids);
  const hinted = await ttlGetMany<true>("local", HINTS_KEY, valid, LIMITS.govHintsTtlMs);
  const todo = valid.filter((id) => !hinted.has(id));
  let queued = 0;
  for (let i = 0; i < todo.length; i += LIMITS.govHintsMaxIds) {
    const chunk = todo.slice(i, i + LIMITS.govHintsMaxIds);
    const res = await gateFetch("/v1/badges/x-government-hints", { method: "POST", body: { ids: chunk } });
    if (res.status !== 202) break; // 429 TWR-BDG-019 or any error: stop, no retry
    queued += chunk.length;
    await ttlSetMany("local", HINTS_KEY, Object.fromEntries(chunk.map((id) => [id, true as const])), HINTS_MAX);
  }
  return { queued };
}
