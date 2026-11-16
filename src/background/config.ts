import type { IngestConfig } from "~/shared/api-types";
import { ALARMS, LIMITS } from "~/shared/constants";
import { gateFetch } from "./api";
import { getLocal, setLocal } from "./store";

const KEY = "ingestConfig";

interface StoredConfig extends IngestConfig { etag: string | null; fetchedAt: number }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function validate(body: unknown): IngestConfig | null {
  if (!isObj(body) || !isObj(body.filters)) return null;
  const { version, filters } = body as { version?: unknown; filters: Record<string, unknown> };
  if (version !== null && typeof version !== "string") return null;
  if (!Array.isArray(filters.keywords) || !filters.keywords.every((k) => typeof k === "string")) return null;
  if (!Array.isArray(filters.accounts)) return null;
  if (!isObj(filters.thresholds)) return null;
  return { version, filters: filters as unknown as IngestConfig["filters"] };
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

export async function getConfig(): Promise<IngestConfig | null> {
  const s = await readStored();
  if (!s) return null;
  if (Date.now() - s.fetchedAt > LIMITS.configPeriodMin * 60_000) void refreshConfig();
  return { version: s.version, filters: s.filters };
}

export async function ensureConfigAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(ALARMS.config))) chrome.alarms.create(ALARMS.config, { periodInMinutes: LIMITS.configPeriodMin });
}
