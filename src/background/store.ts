/** Tiny typed helpers over chrome.storage + a bounded TTL map. No in-memory state. */
export type Area = "local" | "session";

const areaOf = (a: Area) => chrome.storage[a];

async function getArea<T>(a: Area, key: string, fallback: T): Promise<T> {
  const res = await areaOf(a).get(key);
  return key in res ? (res[key] as T) : fallback;
}
async function setArea(a: Area, key: string, value: unknown): Promise<void> {
  await areaOf(a).set({ [key]: value });
}

export const getLocal = <T>(key: string, fallback: T) => getArea<T>("local", key, fallback);
export const setLocal = (key: string, value: unknown) => setArea("local", key, value);
export const getSession = <T>(key: string, fallback: T) => getArea<T>("session", key, fallback);
export const setSession = (key: string, value: unknown) => setArea("session", key, value);

export interface TtlEntry<T> { v: T; t: number }
export type TtlMap<T> = Record<string, TtlEntry<T>>;

/** Returns `{ v }` on a fresh hit (v may be null), `undefined` on miss or expiry. */
export async function ttlGet<T>(area: Area, storeKey: string, key: string, ttlMs: number): Promise<{ v: T } | undefined> {
  const map = await getArea<TtlMap<T>>(area, storeKey, {});
  const e = Object.hasOwn(map, key) ? map[key] : undefined;
  if (!e || Date.now() - e.t > ttlMs) return undefined;
  return { v: e.v };
}

/** Fresh hits for many keys with a single storage read. */
export async function ttlGetMany<T>(area: Area, storeKey: string, keys: string[], ttlMs: number): Promise<Map<string, T>> {
  const map = await getArea<TtlMap<T>>(area, storeKey, {});
  const now = Date.now();
  const out = new Map<string, T>();
  for (const k of keys) {
    const e = Object.hasOwn(map, k) ? map[k] : undefined;
    if (e && now - e.t <= ttlMs) out.set(k, e.v);
  }
  return out;
}

/** Stores entries stamped with now, evicting the oldest beyond `maxEntries`. */
export async function ttlSetMany<T>(area: Area, storeKey: string, entries: Record<string, T>, maxEntries: number): Promise<void> {
  const map = await getArea<TtlMap<T>>(area, storeKey, {});
  const now = Date.now();
  for (const [k, v] of Object.entries(entries)) map[k] = { v, t: now };
  const keys = Object.keys(map);
  if (keys.length > maxEntries) {
    const sorted = keys.map((k, i) => [k, map[k]!.t, i] as const).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    for (const [k] of sorted.slice(0, keys.length - maxEntries)) delete map[k];
  }
  await setArea(area, storeKey, map);
}
