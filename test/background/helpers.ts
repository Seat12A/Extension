import { vi } from "vitest";

export type Route = (url: string, init: RequestInit) => Response | Promise<Response> | undefined;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
export const err = (status: number, code: string) => json({ error: { code, message: "x" } }, status);

/** Stubs global fetch; returns the mock. Unrouted calls fail with a network error. */
export function stubFetch(route: Route) {
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    const r = await route(String(url), init);
    if (!r) throw new TypeError("network");
    return r;
  });
  vi.stubGlobal("fetch", f);
  return f;
}

export const headersOf = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;
export const calls = (f: ReturnType<typeof stubFetch>) => f.mock.calls.map(([u, i]) => ({ url: String(u), init: (i ?? {}) as RequestInit }));

export function obs(id: string | number, over: Record<string, unknown> = {}) {
  return {
    platform: "x" as const,
    external_id: String(id),
    author: { handle: "a" },
    text: "hello",
    observed_at: new Date().toISOString(),
    filter_version: "v1",
    ...over,
  };
}

export async function seedConfig(version: string | null = "v1") {
  await chrome.storage.local.set({
    ingestConfig: { etag: '"e1"', version, filters: { keywords: ["k"], accounts: [], thresholds: {} }, fetchedAt: Date.now() },
  });
}
