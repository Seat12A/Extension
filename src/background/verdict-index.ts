/**
 * Verdict index (Tower, `GET /v1/verdict-index/{platform}/{bucket}`): tells which posts
 * have a visible fact-check WITHOUT sending their ids. Only the bucket (first 4 hex
 * characters of SHA-256(id), shared by ~1 post in 65,536) leaves the device; the full id
 * is sent afterwards only for posts that are in the list (they are fact-checked).
 *
 * The bucket cache lives in MEMORY only (never chrome.storage): nothing the user saw is
 * written anywhere. It is bounded (LRU) and lost when the worker stops, which is fine.
 */
import { gateFetch } from "./api";

export const BUCKET_TTL_MS = 5 * 60_000;
export const BUCKET_MAX = 2_000;
/** Route absent (404, not deployed yet): fall back to filtered posts, check again later. */
const MISSING_RETRY_MS = 10 * 60_000;
/** 5xx / network on a bucket: no retry before this. */
const FAIL_RETRY_MS = 60_000;
const CONCURRENCY = 4;

interface Bucket { hashes: Set<string>; etag: string | null; t: number }

const buckets = new Map<string, Bucket>(); // insertion order = LRU order
const inflight = new Map<string, Promise<Bucket | null>>();
const failedUntil = new Map<string, number>();
let missingUntil = 0;
/** The route answered at least once: no need to probe with a single bucket first. */
let served = false;

/** SHA-256 of the post id as written in its URL (digits, UTF-8), lower-case hex. */
export async function postHash(externalId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(externalId));
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export const bucketOf = (hash: string) => hash.slice(0, 4);

/** True while Tower is known not to serve the index (old behaviour must apply). */
export const indexMissing = () => Date.now() < missingUntil;

function touch(key: string, b: Bucket): void {
  buckets.delete(key);
  buckets.set(key, b);
  while (buckets.size > BUCKET_MAX) buckets.delete(buckets.keys().next().value as string);
}

async function fetchBucket(key: string): Promise<Bucket | null> {
  const prev = buckets.get(key);
  const res = await gateFetch(`/v1/verdict-index/x/${key}`, { headers: prev?.etag ? { "If-None-Match": prev.etag } : {} });
  if (res.status === 304 && prev) {
    const b = { ...prev, t: Date.now() };
    touch(key, b);
    return b;
  }
  if (res.status === 200 && res.body && Array.isArray(res.body.hashes)) {
    const hashes = new Set<string>((res.body.hashes as unknown[]).filter((h): h is string => typeof h === "string").map((h) => h.toLowerCase()));
    const b = { hashes, etag: res.headers.get("ETag"), t: Date.now() };
    touch(key, b);
    served = true;
    return b;
  }
  if (res.status === 404) { missingUntil = Date.now() + MISSING_RETRY_MS; return null; }
  if (res.status === 422) { console.debug("[seat12a] verdict index refused bucket", key); return null; }
  failedUntil.set(key, Date.now() + FAIL_RETRY_MS); // 5xx, network, anything else
  return null;
}

/** Fresh bucket from cache, else one request per bucket however many posts wait for it. */
function getBucket(key: string): Promise<Bucket | null> {
  const hit = buckets.get(key);
  if (hit && Date.now() - hit.t <= BUCKET_TTL_MS) { touch(key, hit); return Promise.resolve(hit); }
  if ((failedUntil.get(key) ?? 0) > Date.now()) return Promise.resolve(null);
  let p = inflight.get(key);
  if (!p) {
    p = fetchBucket(key).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export interface IndexResult {
  /** Ids whose full hash is in their bucket's list: fetch their verdict. */
  verified: string[];
  /** The index is not served (404): the caller keeps the old, filtered-only behaviour. */
  missing: boolean;
}

/** Which of `ids` have a visible fact-check, sending only 4-character buckets. */
export async function checkVerdictIndex(ids: string[]): Promise<IndexResult> {
  if (indexMissing()) return { verified: [], missing: true };
  const withHash = await Promise.all(ids.map(async (id) => ({ id, hash: await postHash(id) })));
  const keys = [...new Set(withHash.map((x) => bucketOf(x.hash)))];
  const lists = new Map<string, Bucket | null>();
  let next = 0;
  // Until the route is known to exist, probe with ONE bucket (a 404 then costs one request).
  if (!served && keys.length) { lists.set(keys[0]!, await getBucket(keys[0]!)); next = 1; }
  if (indexMissing()) return { verified: [], missing: true };
  const worker = async () => {
    while (next < keys.length) {
      const key = keys[next++]!;
      lists.set(key, await getBucket(key));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));
  if (indexMissing()) return { verified: [], missing: true };
  const verified = withHash.filter(({ hash }) => lists.get(bucketOf(hash))?.hashes.has(hash)).map((x) => x.id);
  return { verified, missing: false };
}

/** Popup "reload" and tests. */
export function clearVerdictIndex(): void {
  buckets.clear();
  inflight.clear();
  failedUntil.clear();
  missingUntil = 0;
  served = false;
}

export const verdictIndexSize = () => buckets.size;
