/** Limits mirrored from Tower (see docs/extension guide). Never raise them client-side. */
export const LIMITS = {
  ingestMaxItems: 50, // TOWER_INGEST_MAX_ITEMS
  ingestMaxBytes: 256 * 1024,
  itemMaxTextChars: 20_000,
  dailyQuota: 500, // per installation, reset 00:00 UTC (TWR-ING-002)
  queueMax: 500,
  queueMaxAgeMs: 23 * 60 * 60 * 1000, // server rewrites observed_at older than 24 h
  dedupeMax: 5_000,
  dedupeTtlMs: 24 * 60 * 60 * 1000,
  flushIntervalMs: 60_000,
  configPeriodMin: 15,
  verdictCacheTtlMs: 5 * 60 * 1000,
  verdictCacheMax: 1_000,
  badgeCacheTtlMs: 5 * 60 * 1000,
  badgeCacheMax: 5_000,
  badgeLookupMaxIds: 100,
  badgeBatchDelayMs: 300,
  categoriesTtlMs: 24 * 60 * 60 * 1000,
  govHintsMaxIds: 50,
  govHintsTtlMs: 7 * 24 * 60 * 60 * 1000,
  tokenBytes: 32,
} as const;

/** storage.local key bumped by the popup "reload" button (content scripts listen). */
export const CACHE_EPOCH_KEY = "cacheEpoch";

export const ALARMS = {
  config: "seat12a:config",
  flush: "seat12a:flush",
  categories: "seat12a:categories",
} as const;

export const SUPPORTED_LANGS = ["fr", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
