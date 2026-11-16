import { afterEach, describe, expect, it, vi } from "vitest";
import { getVerdicts } from "~/background/verdicts";
import { calls, err, headersOf, json, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());
const verdict = (id: string) => ({ platform: "x", external_id: id, url: "u", lang: "fr", claims: [] });

describe("verdicts", () => {
  it("404 TWR-FCK-013 is null and cached", async () => {
    const f = stubFetch(() => err(404, "TWR-FCK-013"));
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("500 is null and not cached; 200 returns verdict and caches per lang", async () => {
    let n = 0;
    const f = stubFetch((u) => (u.includes("/1/") ? (n++ === 0 ? err(500, "X") : json(verdict("1"))) : undefined));
    expect(await getVerdicts(["1"], "fr")).toEqual({ "1": null });
    expect((await getVerdicts(["1"], "fr"))["1"]?.external_id).toBe("1");
    await getVerdicts(["1"], "fr");
    expect(f).toHaveBeenCalledTimes(2);
    await getVerdicts(["1"], "en");
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("sanitises ids and lang, sends no token", async () => {
    const f = stubFetch(() => json(verdict("5")));
    const r = await getVerdicts(["5", "../x", "abc"], "FR; drop");
    expect(Object.keys(r)).toEqual(["5"]);
    const c = calls(f);
    expect(c[0]!.url).toContain("/v1/content/x/5/verdict?lang=en");
    expect("X-Installation-Token" in headersOf(c[0]!.init)).toBe(false);
  });
  it("limits concurrency to 4", async () => {
    let cur = 0, max = 0;
    stubFetch(async () => {
      cur++; max = Math.max(max, cur);
      await new Promise((r) => setTimeout(r, 5));
      cur--;
      return json(verdict("1"));
    });
    await getVerdicts(Array.from({ length: 12 }, (_, i) => String(i + 1)), "fr");
    expect(max).toBe(4);
  });
});
