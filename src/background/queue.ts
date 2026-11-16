import type { IngestItem, IngestRequest, IngestResponse, ObservationItem } from "~/shared/api-types";
import { ALARMS, LIMITS } from "~/shared/constants";
import { getSettings } from "~/shared/settings";
import { errorCode, gateFetch } from "./api";
import { readStoredConfig } from "./config";
import { getLocal, getSession, setLocal, setSession } from "./store";
import { getToken, resetToken } from "./token";

export interface SendState {
  backoffUntil: number;
  backoffAttempt: number;
  quotaUntil: string | null;
  sentToday: number;
  sentDate: string;
  lastSyncAt: string | null;
}
const DEFAULT_STATE: SendState = { backoffUntil: 0, backoffAttempt: 0, quotaUntil: null, sentToday: 0, sentDate: "", lastSyncAt: null };

export const BACKOFF_CAP_MS = 30 * 60_000;
const MAX_SPLIT_DEPTH = 6;
const ID_RE = /^\d{1,19}$/;

// ---- pure helpers ---------------------------------------------------------------
export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** base * 2^attempt, ±20 % jitter, capped at 30 min. `random` ∈ [0,1). */
export function computeBackoff(baseMs: number, attempt: number, random: () => number = Math.random): number {
  return Math.min(BACKOFF_CAP_MS, Math.round(baseMs * 2 ** attempt * (0.8 + 0.4 * random())));
}

/** Timestamp until which sending is suspended for quota (remote or local), else null. */
export function suspendedUntil(st: SendState, now: number): number | null {
  if (st.quotaUntil) {
    const q = Date.parse(st.quotaUntil);
    if (q > now) return q;
  }
  if (st.sentDate === utcDate(now) && st.sentToday >= LIMITS.dailyQuota) return nextUtcMidnight(new Date(now)).getTime();
  return null;
}

// ---- state ----------------------------------------------------------------------
export async function loadState(): Promise<SendState> {
  return { ...DEFAULT_STATE, ...(await getLocal<Partial<SendState>>("sendState", {})) };
}

// Serialises read-modify-write sections (a scheduling aid only, holds no durable state).
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

const updateState = (fn: (s: SendState) => SendState) =>
  locked(async () => { await setLocal("sendState", fn(await loadState())); });

const mutateQueue = (fn: (q: ObservationItem[]) => ObservationItem[]) =>
  locked(async () => { await setLocal("queue", fn(await getLocal<ObservationItem[]>("queue", []))); });

// ---- enqueue --------------------------------------------------------------------
export async function enqueue(items: ObservationItem[]): Promise<{ queued: number }> {
  if (!Array.isArray(items)) return { queued: 0 };
  const settings = await getSettings();
  if (!settings.sendObservations) return { queued: 0 };
  const cfg = await readStoredConfig();
  if (!cfg || cfg.version == null) return { queued: 0 };
  const now = Date.now();
  if (suspendedUntil(await loadState(), now)) return { queued: 0 };

  return locked(async () => {
    const dedupe = await getLocal<Record<string, number>>("dedupe", {});
    let queue = await getLocal<ObservationItem[]>("queue", []);
    let added = 0;
    for (const raw of items) {
      if (!raw || raw.platform !== "x" || typeof raw.external_id !== "string" || !ID_RE.test(raw.external_id)) continue;
      const seen = dedupe[raw.external_id];
      if (seen !== undefined && now - seen < LIMITS.dedupeTtlMs) continue;
      const item = { ...raw, text: typeof raw.text === "string" ? raw.text.slice(0, LIMITS.itemMaxTextChars) : "" };
      dedupe[raw.external_id] = now;
      queue.push(item);
      added++;
    }
    const ids = Object.keys(dedupe);
    if (ids.length > LIMITS.dedupeMax) {
      ids.sort((a, b) => dedupe[a]! - dedupe[b]!);
      for (const id of ids.slice(0, ids.length - LIMITS.dedupeMax)) delete dedupe[id];
    }
    if (queue.length > LIMITS.queueMax) queue = queue.slice(queue.length - LIMITS.queueMax);
    await setLocal("dedupe", dedupe);
    await setLocal("queue", queue);
    if (queue.length >= LIMITS.ingestMaxItems) void flush();
    return { queued: added };
  });
}

// ---- flush ----------------------------------------------------------------------
let inflight: Promise<void> | null = null;
const LOCK_STALE_MS = 60_000;

export function flush(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const lock = await getSession<number>("flushLock", 0);
    if (lock && Date.now() - lock < LOCK_STALE_MS) return;
    await setSession("flushLock", Date.now());
    try { await run(); } finally { await chrome.storage.session.remove("flushLock"); }
  })().finally(() => { inflight = null; });
  return inflight;
}

type Outcome = "continue" | "stop";
const enc = new TextEncoder();

/** Wire form of a queued item: `filter_version` moves to the batch, nothing else is sent. */
export function toIngestItem(item: ObservationItem): IngestItem {
  const { filter_version: _v, ...wire } = item as ObservationItem & { url?: unknown };
  delete (wire as { url?: unknown }).url; // never sent (not part of Tower's schema)
  return wire;
}
const bodyOf = (items: ObservationItem[]): IngestRequest => ({ filter_version: items[0]?.filter_version ?? null, items: items.map(toIngestItem) });

/**
 * Next batch: items sharing the oldest item's filter version (one version per request),
 * ≤ 50 items and ≤ 256 KB of UTF-8 JSON.
 */
function takeBatch(queue: ObservationItem[]): { batch: ObservationItem[]; oversized?: ObservationItem } {
  const batch: ObservationItem[] = [];
  const version = queue[0]?.filter_version ?? null;
  let bytes = enc.encode(JSON.stringify({ filter_version: version, items: [] })).length;
  for (const item of queue) {
    if (batch.length >= LIMITS.ingestMaxItems) break;
    if ((item.filter_version ?? null) !== version) continue;
    const size = enc.encode(JSON.stringify(toIngestItem(item))).length + (batch.length ? 1 : 0);
    if (bytes + size > LIMITS.ingestMaxBytes) {
      if (batch.length === 0) return { batch, oversized: item };
      break;
    }
    bytes += size;
    batch.push(item);
  }
  return { batch };
}

const removeItems = (items: ObservationItem[]) => {
  const ids = new Set(items.map((i) => i.external_id));
  return mutateQueue((q) => q.filter((i) => !ids.has(i.external_id)));
};

const applyBackoff = (baseMs: number) =>
  updateState((s) => ({ ...s, backoffUntil: Date.now() + computeBackoff(baseMs, s.backoffAttempt), backoffAttempt: s.backoffAttempt + 1 }));

async function run(): Promise<void> {
  if (!(await getSettings()).sendObservations) return;
  const now = Date.now();
  const st = await loadState();
  const until = suspendedUntil(st, now);
  if (until) {
    if (!st.quotaUntil || Date.parse(st.quotaUntil) < until) await updateState((s) => ({ ...s, quotaUntil: new Date(until).toISOString() }));
    return;
  }
  if (now < st.backoffUntil) return;
  await mutateQueue((q) => q.filter((i) => Date.parse(i.observed_at) >= now - LIMITS.queueMaxAgeMs));

  const token = await getToken();
  for (let guard = 0; guard < 200; guard++) {
    const queue = await getLocal<ObservationItem[]>("queue", []);
    if (!queue.length) break;
    const { batch, oversized } = takeBatch(queue);
    if (oversized) { await removeItems([oversized]); continue; }
    if ((await sendBatch(batch, token, 0)) === "stop") break;
  }
}

async function sendBatch(items: ObservationItem[], token: string, depth: number): Promise<Outcome> {
  const res = await gateFetch("/v1/ingest/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Installation-Token": token },
    body: bodyOf(items),
  });
  const code = errorCode(res.body);

  if (res.status === 202) {
    const accepted = Number((res.body as Partial<IngestResponse> | null)?.accepted);
    await removeItems(items);
    let exhausted = false;
    await updateState((s) => {
      const t = Date.now();
      const today = utcDate(t);
      const sentToday = (s.sentDate === today ? s.sentToday : 0) + (Number.isFinite(accepted) ? accepted : 0);
      const next = { ...s, sentToday, sentDate: today, backoffUntil: 0, backoffAttempt: 0, lastSyncAt: new Date(t).toISOString() };
      if (sentToday >= LIMITS.dailyQuota) {
        exhausted = true;
        next.quotaUntil = nextUtcMidnight(new Date(t)).toISOString();
      }
      return next;
    });
    return exhausted ? "stop" : "continue";
  }
  if (res.status === 401 && code === "TWR-ING-001") {
    // Malformed token (should never happen): regenerate once and retry, else drop the batch.
    if (depth >= MAX_SPLIT_DEPTH) { await removeItems(items); return "continue"; }
    const fresh = await resetToken();
    return sendBatch(items, fresh, MAX_SPLIT_DEPTH);
  }
  if (res.status === 429 && code === "TWR-ING-002") {
    await updateState((s) => ({ ...s, quotaUntil: nextUtcMidnight(new Date()).toISOString() }));
    await mutateQueue(() => []);
    return "stop";
  }
  if (res.status === 429 && code === "TWR-ING-007") { await applyBackoff(30_000); return "stop"; }
  if ((res.status === 422 && code === "TWR-ING-003") || (res.status === 413 && code === "TWR-ING-004")) {
    if (items.length <= 1 || depth >= MAX_SPLIT_DEPTH) { await removeItems(items); return "continue"; }
    const mid = Math.ceil(items.length / 2);
    if ((await sendBatch(items.slice(0, mid), token, depth + 1)) === "stop") return "stop";
    return sendBatch(items.slice(mid), token, depth + 1);
  }
  if (res.status === 503 && code === "TWR-ING-010") { await applyBackoff(60_000); return "stop"; }
  if (res.status === 0 || res.status >= 500) { await applyBackoff(30_000); return "stop"; }
  console.debug("[seat12a] ingest batch dropped, status", res.status);
  await removeItems(items);
  return "continue";
}

export async function ensureFlushAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(ALARMS.flush))) chrome.alarms.create(ALARMS.flush, { periodInMinutes: 1 });
}
