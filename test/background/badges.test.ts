import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountDetail, getBadgeCategories, lookupBadges, sendGovernmentHints } from "~/background/badges";
import { LIMITS } from "~/shared/constants";
import { calls, err, headersOf, json, stubFetch } from "./helpers";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
// Lookup shape of 2026-11-21: the check comes from `badge` only.
const acc = {
  category: "media", color: "#D946EF",
  badge: { category: "media", color: "#D946EF", label: "Le Monde", expertise: null },
  affiliation: null, affiliations: [],
};

describe("lookupBadges", () => {
  it("chunks sorted ids by 100 and caches absent ids as null", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(1000 - i)).concat(["99", "bad", "99"]);
    const f = stubFetch((u) => {
      const q = new URL(u).searchParams.get("ids")!.split(",");
      return json({ accounts: Object.fromEntries(q.filter((i) => i === "99").map((i) => [i, acc])) });
    });
    const r = await lookupBadges(ids);
    const cs = calls(f);
    expect(cs.length).toBe(2);
    const first = new URL(cs[0]!.url).searchParams.get("ids")!.split(",");
    expect(first.length).toBe(LIMITS.badgeLookupMaxIds);
    expect(first[0]).toBe("99");
    expect(first[1]).toBe("851");
    expect(r["99"]).toEqual(acc);
    expect(r["1000"]).toBeNull();
    expect("bad" in r).toBe(false);
    await lookupBadges(["99", "1000"]);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("uses ETag and reuses body on 304", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    stubFetch(() => json({ accounts: { "1": acc } }, 200, { ETag: '"t"' }));
    await lookupBadges(["1"]);
    vi.setSystemTime(1_000_000 + LIMITS.badgeCacheTtlMs + 1);
    const f = stubFetch(() => new Response(null, { status: 304 }));
    const r = await lookupBadges(["1"]);
    expect(headersOf(calls(f)[0]!.init)["If-None-Match"]).toBe('"t"');
    expect(r["1"]).toEqual(acc);
  });
  it("errors are null and not cached", async () => {
    const f = stubFetch(() => err(429, "TWR-ING-006"));
    expect(await lookupBadges(["1"])).toEqual({ "1": null });
    await lookupBadges(["1"]);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("categories and detail", () => {
  it("sorts by rank, caches and falls back to stored", async () => {
    const f = stubFetch(() => json({ items: [{ category: "b", color: "#1", rank: 2 }, { category: "a", color: "#2", rank: 1 }] }));
    expect((await getBadgeCategories()).map((c) => c.category)).toEqual(["a", "b"]);
    await getBadgeCategories();
    expect(f).toHaveBeenCalledTimes(1);
    stubFetch(() => undefined);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + LIMITS.categoriesTtlMs + 1000);
    expect((await getBadgeCategories()).length).toBe(2);
  });
  it("returns [] on failure with nothing stored", async () => {
    stubFetch(() => undefined);
    expect(await getBadgeCategories()).toEqual([]);
  });
  it("account detail: 200 cached, 404 null", async () => {
    const f = stubFetch((u) => (u.endsWith("/1") ? json({ ...acc, platform: "x", external_id: "1" }) : err(404, "TWR-BDG-001")));
    expect((await getAccountDetail("1"))?.external_id).toBe("1");
    await getAccountDetail("1");
    expect(f).toHaveBeenCalledTimes(1);
    expect(await getAccountDetail("2")).toBeNull();
    expect(await getAccountDetail("zz")).toBeNull();
  });
});

describe("lookup shape (2026-11-21)", () => {
  it("affiliated-only accounts get no check, personality is read as verified, extra fields are kept", async () => {
    const org = { platform: "x", external_id: "111", category: "media", color: "#D946EF", label: "Le Journal", logo_url: "https://cdn/l.png" };
    stubFetch(() => json({ platform: "x", accounts: {
      "1": { category: null, color: null, badge: null, affiliation: { org, title: "Reporter" },
             affiliations: [{ org, title: "Reporter" }, { org: { ...org, external_id: "222", label: "Université X", logo_url: null, category: "organization" }, title: null }] },
      "2": { category: "personality", color: "#3B5BFF", badge: { category: "personality", color: "#3B5BFF", label: "Dr A", expertise: null }, affiliation: null, affiliations: [] },
      "3": { category: "expert", color: "#22D3EE", badge: { category: "expert", color: "#22D3EE", label: "Dr B", expertise: "épidémiologie" }, affiliation: null, affiliations: [] },
      "4": { category: null, color: null, badge: null, affiliation: null, affiliations: [] },
    } }));
    const r = await lookupBadges(["1", "2", "3", "4"]);
    expect(r["1"]).toEqual({
      category: null, color: null, badge: null,
      affiliation: { org: { ...org }, title: "Reporter" },
      affiliations: [
        { org: { ...org }, title: "Reporter" },
        { org: { ...org, external_id: "222", label: "Université X", logo_url: null, category: "organization" }, title: null },
      ],
    });
    expect(r["2"]).toMatchObject({ category: "verified", badge: { category: "verified" } });
    expect(r["3"]!.badge!.expertise).toBe("épidémiologie");
    expect(r["4"]).toBeNull();
  });
});

describe("government hints", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  it("dedupes for 7 days and chunks by 50", async () => {
    const f = stubFetch(() => json({}, 202));
    const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
    expect((await sendGovernmentHints(ids)).queued).toBe(120);
    expect(calls(f).map((c) => JSON.parse(c.init.body as string).ids.length)).toEqual([50, 50, 20]);
    expect((await sendGovernmentHints(ids)).queued).toBe(0);
    expect(f).toHaveBeenCalledTimes(3);
    vi.setSystemTime(1_000_000 + LIMITS.govHintsTtlMs + 1);
    expect((await sendGovernmentHints(["1", "x"])).queued).toBe(1);
  });
  it("TWR-BDG-019 stops without retry or marking", async () => {
    const f = stubFetch(() => err(429, "TWR-BDG-019"));
    const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
    expect((await sendGovernmentHints(ids)).queued).toBe(0);
    expect(f).toHaveBeenCalledTimes(1);
    expect("X-Installation-Token" in headersOf(calls(f)[0]!.init)).toBe(false);
    const g = stubFetch(() => json({}, 202));
    expect((await sendGovernmentHints(["1"])).queued).toBe(1);
    expect(g).toHaveBeenCalledTimes(1);
  });
});
