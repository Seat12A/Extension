import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getVerdicts } from "~/background/verdicts";
import { BUCKET_MAX, bucketOf, checkVerdictIndex, clearVerdictIndex, postHash, verdictIndexSize } from "~/background/verdict-index";
import { calls, err, headersOf, json, stubFetch } from "./helpers";

beforeEach(() => clearVerdictIndex());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const verdict = (id: string) => ({ platform: "x", external_id: id, url: "u", lang: "fr", claims: [] });
const INDEX = "/v1/verdict-index/x/";
/** Index served, listing exactly `verified`. */
async function served(verified: string[]) {
  const hashes = await Promise.all(verified.map(postHash));
  return (u: string) => {
    const b = u.split(INDEX)[1]!;
    return json({ platform: "x", bucket: b, hashes: hashes.filter((h) => bucketOf(h) === b).sort() }, 200, { ETag: `"${b}"` });
  };
}

describe("verdict index", () => {
  it("hashes the id as written in the URL (Tower's test vector)", async () => {
    const h = await postHash("1856000000000000000");
    expect(h).toBe("6f5893791244b945fa04f4d1589f6e996baefc800236a63f1bcb57e16acbd9af");
    expect(bucketOf(h)).toBe("6f58");
  });

  it("sends only 4-char buckets, never an id, and looks up by id only the listed posts", async () => {
    const index = await served(["1856000000000000000"]);
    const f = stubFetch((u) => (u.includes(INDEX) ? index(u) : u.includes("/1856000000000000000/") ? json(verdict("1856000000000000000")) : undefined));
    const r = await getVerdicts(["1856000000000000000", "1856000000000000001", "1856000000000000002"], "fr", []);
    expect(r["1856000000000000000"]?.external_id).toBe("1856000000000000000");
    expect(r["1856000000000000001"]).toBeNull();
    const urls = calls(f).map((c) => c.url);
    for (const u of urls.filter((x) => x.includes(INDEX))) expect(u).toMatch(/\/v1\/verdict-index\/x\/[0-9a-f]{4}$/);
    const byId = urls.filter((u) => u.includes("/v1/content/"));
    expect(byId).toHaveLength(1);
    expect(urls.join(" ")).not.toContain("1856000000000000001");
    expect(urls.join(" ")).not.toContain("1856000000000000002");
    for (const c of calls(f)) expect("X-Installation-Token" in headersOf(c.init)).toBe(false);
  });

  it("one request per bucket, cached 5 min, then revalidated with If-None-Match (304 keeps the list)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    const h = await postHash("42");
    let n = 0;
    const f = stubFetch((_u, init) => {
      n++;
      if ((init.headers as Record<string, string>)?.["If-None-Match"] === '"e1"') return new Response(null, { status: 304 });
      return json({ platform: "x", bucket: bucketOf(h), hashes: [h] }, 200, { ETag: '"e1"' });
    });
    const [a, b] = await Promise.all([checkVerdictIndex(["42"]), checkVerdictIndex(["42"])]);
    expect(a.verified).toEqual(["42"]);
    expect(b.verified).toEqual(["42"]);
    expect(n).toBe(1); // in-flight request shared
    await checkVerdictIndex(["42"]);
    expect(n).toBe(1);
    vi.setSystemTime(1_000_000 + 5 * 60_000 + 1);
    expect((await checkVerdictIndex(["42"])).verified).toEqual(["42"]);
    expect(n).toBe(2);
    expect((calls(f).at(-1)!.init.headers as Record<string, string>)["If-None-Match"]).toBe('"e1"');
  });

  it("route not deployed (404): old behaviour, filtered posts only", async () => {
    const f = stubFetch((u) => (u.includes(INDEX) ? err(404, "TWR-GEN-002") : json(verdict(u.split("/")[6]!))));
    const r = await getVerdicts(["1", "2", "3"], "fr", ["2"]);
    expect(r["2"]?.external_id).toBe("2");
    expect(r["1"]).toBeNull();
    const byId = calls(f).filter((c) => c.url.includes("/v1/content/"));
    expect(byId.map((c) => c.url)).toEqual([expect.stringContaining("/v1/content/x/2/verdict")]);
    // and no new index request for a while
    await getVerdicts(["4"], "fr", []);
    expect(calls(f).filter((c) => c.url.includes(INDEX))).toHaveLength(1);
  });

  it("5xx / network on a bucket: nothing shown, no retry storm", async () => {
    const f = stubFetch((u) => (u.includes(INDEX) ? err(503, "X") : undefined));
    expect(await getVerdicts(["7"], "fr", ["7"])).toEqual({ "7": null });
    await getVerdicts(["7"], "fr", ["7"]);
    expect(calls(f).filter((c) => c.url.includes(INDEX))).toHaveLength(1);
    expect(calls(f).filter((c) => c.url.includes("/v1/content/"))).toHaveLength(0);
  });

  it("listed but verdict 404 (expired in between): nothing shown", async () => {
    const index = await served(["9"]);
    stubFetch((u) => (u.includes(INDEX) ? index(u) : err(404, "TWR-FCK-013")));
    expect(await getVerdicts(["9"], "fr")).toEqual({ "9": null });
  });

  it("bucket cache is bounded", async () => {
    stubFetch((u) => json({ platform: "x", bucket: u.slice(-4), hashes: [] }, 200));
    const ids = Array.from({ length: 6000 }, (_, i) => String(1_000_000 + i));
    await checkVerdictIndex(ids);
    expect(verdictIndexSize()).toBeLessThanOrEqual(BUCKET_MAX);
  });
});

describe("verdicts", () => {
  it("404 TWR-FCK-013 is null and cached", async () => {
    const index = await served(["1"]);
    const f = stubFetch((u) => (u.includes(INDEX) ? index(u) : err(404, "TWR-FCK-013")));
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect(calls(f).filter((c) => c.url.includes("/v1/content/"))).toHaveLength(1);
  });
  it("500 is null and not cached; 200 returns verdict and caches per lang", async () => {
    const index = await served(["1"]);
    let n = 0;
    const f = stubFetch((u) => (u.includes(INDEX) ? index(u) : u.includes("/1/") ? (n++ === 0 ? err(500, "X") : json(verdict("1"))) : undefined));
    const byId = () => calls(f).filter((c) => c.url.includes("/v1/content/")).length;
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect((await getVerdicts(["1"], "fr"))["1"]?.external_id).toBe("1");
    await getVerdicts(["1"], "fr");
    expect(byId()).toBe(2);
    await getVerdicts(["1"], "en");
    expect(byId()).toBe(3);
  });
  it("sanitises ids and lang, sends no token", async () => {
    const index = await served(["5"]);
    const f = stubFetch((u) => (u.includes(INDEX) ? index(u) : json(verdict("5"))));
    const r = await getVerdicts(["5", "../x", "abc"], "FR; drop");
    expect(Object.keys(r)).toEqual(["5"]);
    const c = calls(f).filter((x) => x.url.includes("/v1/content/"));
    expect(c[0]!.url).toContain("/v1/content/x/5/verdict?lang=en");
    expect("X-Installation-Token" in headersOf(c[0]!.init)).toBe(false);
  });
  it("limits concurrency to 4", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const index = await served(ids);
    let cur = 0, max = 0;
    stubFetch(async (u) => {
      if (u.includes(INDEX)) return index(u);
      cur++; max = Math.max(max, cur);
      await new Promise((r) => setTimeout(r, 5));
      cur--;
      return json(verdict("1"));
    });
    await getVerdicts(ids, "fr");
    expect(max).toBe(4);
  });
});
