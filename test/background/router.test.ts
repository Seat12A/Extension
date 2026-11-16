import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chromeMock } from "../chrome-mock";
import { getToken } from "~/background/token";
import { err, json, stubFetch } from "./helpers";
import type { Request } from "~/shared/messages";

let handle: typeof import("~/background/router").handle;

beforeEach(async () => {
  vi.resetModules();
  stubFetch(() => err(404, "TWR-X"));
  await import("~/background/index");
  ({ handle } = await import("~/background/router"));
});
afterEach(() => vi.unstubAllGlobals());

const send = (msg: unknown, id: string | undefined = chrome.runtime.id) =>
  new Promise<unknown>((resolve) => {
    const rets = chromeMock.runtime.onMessage._fire(msg, { id }, resolve);
    if (!rets.some(Boolean)) resolve("ignored");
  });

describe("router", () => {
  it("ignores foreign senders", async () => {
    expect(await send({ type: "getStatus" }, "other-ext")).toBe("ignored");
  });
  it("unknown type gives __error", async () => {
    expect(await send({ type: "nope" })).toEqual({ __error: "unknown_request" });
    expect(await send(null)).toEqual({ __error: "unknown_request" });
  });
  it("handles every request type", async () => {
    const acct = { platform: "x" as const, external_id: "1" };
    const reqs: Request[] = [
      { type: "observe", items: [] }, { type: "getConfig" }, { type: "getVerdicts", ids: ["1"], lang: "fr" },
      { type: "lookupBadges", ids: ["1"] }, { type: "getBadgeCategories" }, { type: "getAccountDetail", id: "1" },
      { type: "governmentHints", ids: ["1"] }, { type: "submitBadgeRequest", body: { kind: "badge", account: acct, justification: "j" } },
      { type: "submitBadgeReport", body: { account: acct, reason: "other" } }, { type: "getStatus" },
      { type: "resetToken" }, { type: "openOptions" },
    ];
    for (const r of reqs) {
      const res = await send(r);
      expect(res, r.type).not.toEqual({ __error: "unknown_request" });
      expect(res, r.type).not.toBeUndefined();
    }
  });
  it("resetToken changes token and never returns it", async () => {
    const a = await getToken();
    const res = await handle({ type: "resetToken" });
    expect(res).toEqual({ ok: true });
    expect(await getToken()).not.toBe(a);
  });
  it("openOptions validates hash", async () => {
    await handle({ type: "openOptions", hash: "privacy" });
    expect(chromeMock.tabs.create).toHaveBeenLastCalledWith({ url: "chrome-extension://test-extension-id/options.html#privacy" });
    await handle({ type: "openOptions", hash: "<script>" });
    expect(chromeMock.tabs.create).toHaveBeenLastCalledWith({ url: "chrome-extension://test-extension-id/options.html" });
  });
  it("registers alarms and listeners at load", () => {
    expect(chromeMock.alarms._alarms.get("seat12a:config").periodInMinutes).toBe(15);
    expect(chromeMock.alarms._alarms.get("seat12a:flush").periodInMinutes).toBe(1);
    expect(chromeMock.alarms._alarms.get("seat12a:categories").periodInMinutes).toBe(1440);
    expect(chromeMock.runtime.onInstalled._listeners.size).toBeGreaterThan(0);
  });
  it("onInstalled(install) creates the token and fetches config", async () => {
    stubFetch(() => json({ version: "v1", filters: { keywords: [], accounts: [], thresholds: {} } }, 200));
    chromeMock.runtime.onInstalled._fire({ reason: "install" });
    await vi.waitFor(async () => expect(((await chrome.storage.local.get("ingestConfig")) as any).ingestConfig?.version).toBe("v1"));
    expect((await chrome.storage.local.get("installToken")).installToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
