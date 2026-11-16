import { describe, expect, it, vi } from "vitest";
import { getConfig, refreshConfig } from "~/background/config";
import { headersOf, json, stubFetch } from "./helpers";

const body = (version: string | null = "v2") => ({ version, filters: { keywords: ["a"], accounts: [], thresholds: { x: 1 } } });

describe("config", () => {
  it("returns null without config", async () => {
    expect(await getConfig()).toBeNull();
  });
  it("200 stores etag/version", async () => {
    const f = stubFetch(() => json(body(), 200, { ETag: '"abc"' }));
    await refreshConfig();
    const c = await getConfig();
    expect(c?.version).toBe("v2");
    expect(((await chrome.storage.local.get("ingestConfig")) as any).ingestConfig.etag).toBe('"abc"');
    expect(headersOf(f.mock.calls[0]![1] as RequestInit)["If-None-Match"]).toBeUndefined();
  });
  it("304 keeps filters and sends If-None-Match", async () => {
    stubFetch(() => json(body(), 200, { ETag: '"abc"' }));
    await refreshConfig();
    const f = stubFetch(() => new Response(null, { status: 304 }));
    await refreshConfig();
    expect(headersOf(f.mock.calls[0]![1] as RequestInit)["If-None-Match"]).toBe('"abc"');
    expect((await getConfig())?.version).toBe("v2");
  });
  it("network error keeps old config", async () => {
    stubFetch(() => json(body(), 200));
    await refreshConfig();
    stubFetch(() => undefined);
    await refreshConfig();
    expect((await getConfig())?.version).toBe("v2");
  });
  it("invalid body ignored", async () => {
    stubFetch(() => json(body("v2"), 200));
    await refreshConfig();
    stubFetch(() => json({ version: "v3", filters: { keywords: "nope", accounts: [], thresholds: {} } }, 200));
    await refreshConfig();
    expect((await getConfig())?.version).toBe("v2");
  });
});

describe("config contract: no active version", () => {
  it("version null with filters {} replaces the previous config (nothing is sent anymore)", async () => {
    const { refreshConfig, getConfig } = await import("~/background/config");
    const { chromeMock } = await import("../chrome-mock");
    await chromeMock.storage.local.set({ ingestConfig: { etag: '"a"', version: "v1", filters: { keywords: ["x"], accounts: [], thresholds: {} }, fetchedAt: Date.now() } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: null, filters: {} }), { status: 200, headers: { etag: 'W/"0123456789abcdef"' } })));
    await refreshConfig();
    expect(await getConfig()).toEqual({ version: null, filters: { keywords: [], accounts: [], thresholds: {} } });
  });
});
