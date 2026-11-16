import { afterEach, describe, expect, it, vi } from "vitest";
import { submitBadgeReport, submitBadgeRequest } from "~/background/forms";
import { calls, err, json, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());
const account = { platform: "x" as const, external_id: "1" };

describe("forms", () => {
  it("201 ok and strips empty optional fields", async () => {
    const f = stubFetch(() => json({}, 201));
    expect(await submitBadgeRequest({ kind: "badge", account, justification: "j", contact: "", title: undefined, evidence_urls: ["", "https://a"] })).toEqual({ ok: true });
    const c = calls(f)[0]!;
    expect(c.url.endsWith("/v1/badges/requests")).toBe(true);
    expect(JSON.parse(c.init.body as string)).toEqual({ kind: "badge", account, justification: "j", evidence_urls: ["https://a"] });
  });
  it("returns error code, generic and network without retrying", async () => {
    const f = stubFetch(() => err(429, "TWR-BDG-019"));
    expect(await submitBadgeReport({ account, reason: "other" })).toEqual({ ok: false, code: "TWR-BDG-019" });
    stubFetch(() => json({}, 500));
    expect(await submitBadgeReport({ account, reason: "other" })).toEqual({ ok: false, code: "generic" });
    const n = stubFetch(() => undefined);
    expect(await submitBadgeReport({ account, reason: "other" })).toEqual({ ok: false, code: "network" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(n).toHaveBeenCalledTimes(1);
  });
});
