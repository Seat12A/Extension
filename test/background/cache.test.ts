import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupBadges } from "~/background/badges";
import { clearCaches } from "~/background/cache";
import { calls, json, seedConfig, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("clearCaches (popup reload)", () => {
  it("forgets cached answers, keeps token/queue/settings, refetches and notifies tabs", async () => {
    let badge: unknown = null;
    const f = stubFetch((u) => {
      if (u.includes("/v1/badges/lookup")) return json({ accounts: badge ? { "24744541": badge } : {} }, 200, { ETag: '"a"' });
      if (u.includes("/v1/ingest/config")) return json({ version: "v2", filters: {} }, 200, { ETag: '"c2"' });
      if (u.includes("/v1/badges/categories")) return json([]);
      return undefined;
    });
    await seedConfig("v1");
    await chrome.storage.local.set({ installToken: "tok", queue: [1], settings: { showBadges: true } });
    await chrome.storage.session.set({ authorIds: { lemondefr: "24744541" } });

    expect((await lookupBadges(["24744541"]))["24744541"]).toBeNull(); // "no badge", cached
    badge = { category: "media", color: "#D946EF", badge: { category: "media", color: "#D946EF", label: null, expertise: null }, affiliation: null, affiliations: [] };
    expect((await lookupBadges(["24744541"]))["24744541"]).toBeNull(); // still the cached answer

    await clearCaches();
    const local = await chrome.storage.local.get(null);
    expect(local.installToken).toBe("tok");
    expect(local.queue).toEqual([1]);
    expect(local.settings).toEqual({ showBadges: true });
    expect(typeof local.cacheEpoch).toBe("number");
    expect((local.ingestConfig as { version: string }).version).toBe("v2");
    const session = await chrome.storage.session.get(null);
    expect(session.authorIds).toBeUndefined();

    // Config refetched without If-None-Match and bypassing the HTTP cache.
    const cfg = calls(f).filter((c) => c.url.includes("/v1/ingest/config")).at(-1)!;
    expect((cfg.init.headers as Record<string, string>)["If-None-Match"]).toBeUndefined();
    expect(cfg.init.cache).toBe("reload");

    expect((await lookupBadges(["24744541"]))["24744541"]).toEqual(badge);
    expect(calls(f).filter((c) => c.url.includes("/v1/badges/lookup")).at(-1)!.init.cache).toBe("reload");
  });
});
