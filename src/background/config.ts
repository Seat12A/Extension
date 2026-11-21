import type { IngestConfig } from "~/shared/api-types";
import { ALARMS, LIMITS } from "~/shared/constants";
import { gateFetch } from "./api";
import { getLocal, setLocal } from "./store";

const KEY = "ingestConfig";

interface StoredConfig extends IngestConfig { etag: string | null; fetchedAt: number }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Tower: `version` is a string or null; with no active version `filters` is `{}`.
 * Every filter key may be absent and is then treated as empty. Anything malformed
 * (wrong types) is rejected and the previous config is kept.
 */
function validate(body: unknown): IngestConfig | null {
  if (!isObj(body)) return null;
  const version = typeof body.version === "string" && body.version ? body.version : body.version == null ? null : undefined;
  if (version === undefined) return null;
  const f = body.filters == null ? {} : body.filters;
  if (!isObj(f)) return null;
  const keywords = f.keywords ?? [];
  const accounts = f.accounts ?? [];
  const thresholds = f.thresholds ?? {};
  if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string")) return null;
  if (!Array.isArray(accounts) || !accounts.every((a) => isObj(a) && typeof a.external_id === "string")) return null;
  if (!isObj(thresholds) || !Object.values(thresholds).every((n) => typeof n === "number")) return null;
  return {
    version,
    filters: {
      keywords: keywords as string[],
      accounts: (accounts as Record<string, unknown>[]).map((a) => ({ platform: "x" as const, external_id: String(a.external_id) })),
      thresholds: thresholds as Record<string, number>,
    },
  };
}

async function readStored(): Promise<StoredConfig | null> {
  return getLocal<StoredConfig | null>(KEY, null);
}

/** Stored config without triggering any refresh. */
export async function readStoredConfig(): Promise<IngestConfig | null> {
  const s = await readStored();
  return s ? { version: s.version, filters: s.filters } : null;
}

let inflight: Promise<void> | null = null;

export function refreshConfig(): Promise<void> {
  inflight ??= doRefresh().finally(() => { inflight = null; });
  return inflight;
}

async function doRefresh(): Promise<void> {
  try {
    const stored = await readStored();
    const headers: Record<string, string> = {};
    if (stored?.etag) headers["If-None-Match"] = stored.etag;
    const res = await gateFetch("/v1/ingest/config", { headers });
    if (res.status === 304 && stored) {
      await setLocal(KEY, { ...stored, fetchedAt: Date.now() });
    } else if (res.status === 200) {
      const cfg = validate(res.body);
      if (!cfg) return;
      const next: StoredConfig = { ...cfg, etag: res.headers.get("ETag"), fetchedAt: Date.now() };
      await setLocal(KEY, next);
    }
  } catch {
    // keep stored config untouched
  }
}

/** Refetch now, without If-None-Match (popup "reload"). */
export async function forceRefreshConfig(): Promise<void> {
  const stored = await readStored();
  if (stored?.etag) await setLocal(KEY, { ...stored, etag: null });
  await refreshConfig();
}

export async function getConfig(): Promise<IngestConfig | null> {
  const s = await readStored();
  if (!s) return null;
  if (Date.now() - s.fetchedAt > LIMITS.configPeriodMin * 60_000) void refreshConfig();
  return { version: s.version, filters: s.filters };
}

export async function ensureConfigAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(ALARMS.config))) chrome.alarms.create(ALARMS.config, { periodInMinutes: LIMITS.configPeriodMin });
}
