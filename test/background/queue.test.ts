import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBackoff, enqueue, flush, nextUtcMidnight } from "~/background/queue";
import { getStatus } from "~/background/status";
import { getToken } from "~/background/token";
import { lookupBadges } from "~/background/badges";
import { getVerdicts } from "~/background/verdicts";
import { submitBadgeReport } from "~/background/forms";
import { updateSettings } from "~/shared/settings";
import { LIMITS } from "~/shared/constants";
import { calls, err, headersOf, json, obs, seedConfig, stubFetch } from "./helpers";

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);
const queueLen = async () => (((await chrome.storage.local.get("queue")) as any).queue ?? []).length;
const ok = (accepted: number) => json({ accepted, new: accepted, duplicates: 0, rejected: 0, errors: [] }, 202);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("pure helpers", () => {
  it("nextUtcMidnight", () => {
    expect(nextUtcMidnight(new Date("2026-06-10T23:59:59Z")).toISOString()).toBe("2026-06-11T00:00:00.000Z");
    expect(nextUtcMidnight(new Date("2026-12-31T10:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("computeBackoff doubles, jitters and caps", () => {
    expect(computeBackoff(30_000, 0, () => 0.5)).toBe(30_000);
    expect(computeBackoff(30_000, 1, () => 0.5)).toBe(60_000);
    expect(computeBackoff(30_000, 0, () => 0)).toBe(24_000);
    expect(computeBackoff(30_000, 0, () => 1)).toBe(36_000);
    expect(computeBackoff(30_000, 30, () => 0.9)).toBe(30 * 60_000);
  });
});

describe("enqueue", () => {
  it("queues nothing when version null, no config, or sending off", async () => {
    expect((await enqueue([obs(1)])).queued).toBe(0);
    await seedConfig(null);
    expect((await enqueue([obs(1)])).queued).toBe(0);
    await seedConfig("v1");
    await updateSettings({ sendObservations: false });
    expect((await enqueue([obs(1)])).queued).toBe(0);
    expect(await queueLen()).toBe(0);
  });
  it("validates items and truncates text", async () => {
    await seedConfig();
    const r = await enqueue([obs("abc"), obs(1, { platform: "y" }), obs("123456789012345678901"), obs(5, { text: "x".repeat(30_000) })]);
    expect(r.queued).toBe(1);
    const q = ((await chrome.storage.local.get("queue")) as any).queue;
    expect(q[0].text.length).toBe(LIMITS.itemMaxTextChars);
  });
  it("dedupes for 24h", async () => {
    await seedConfig();
    expect((await enqueue([obs(1)])).queued).toBe(1);
    expect((await enqueue([obs(1)])).queued).toBe(0);
    vi.setSystemTime(T0 + LIMITS.dedupeTtlMs - 1000);
    expect((await enqueue([obs(1)])).queued).toBe(0);
    vi.setSystemTime(T0 + LIMITS.dedupeTtlMs + 1000);
    expect((await enqueue([obs(1)])).queued).toBe(1);
  });
  it("caps the queue at 500 dropping oldest", async () => {
    await seedConfig();
    stubFetch(() => undefined); // flushes triggered by the 50-threshold fail with backoff
    for (let b = 0; b < 12; b++) await enqueue(Array.from({ length: 50 }, (_, i) => obs(b * 50 + i + 1)));
    const q = ((await chrome.storage.local.get("queue")) as any).queue;
    expect(q.length).toBe(LIMITS.queueMax);
    expect(q[0].external_id).toBe("101");
  });
});

describe("flush", () => {
  it("splits batches at 50 items and only ingest carries the token", async () => {
    await seedConfig();
    const f = stubFetch((u, init) => (u.endsWith("/v1/ingest/observations") ? ok(JSON.parse(init.body as string).items.length) : undefined));
    await chrome.storage.local.set({ queue: Array.from({ length: 120 }, (_, i) => obs(i + 1)) });
    await flush();
    const cs = calls(f);
    expect(cs.map((c) => JSON.parse(c.init.body as string).items.length)).toEqual([50, 50, 20]);
    const token = await getToken();
    for (const c of cs) {
      expect(headersOf(c.init)["X-Installation-Token"]).toBe(token);
      expect(Object.keys(JSON.parse(c.init.body as string))).toEqual(["items"]);
      expect(c.init.credentials).toBe("omit");
    }
    expect(await queueLen()).toBe(0);
    const st = await getStatus();
    expect(st.sentToday).toBe(120);
    expect(st.state).toBe("active");
    expect(st.lastSyncAt).not.toBeNull();
  });
  it("splits batches at 256 KB", async () => {
    await seedConfig();
    const f = stubFetch((_u, init) => ok(JSON.parse(init.body as string).items.length));
    await chrome.storage.local.set({ queue: Array.from({ length: 30 }, (_, i) => obs(i + 1, { text: "é".repeat(15_000) })) });
    await flush();
    const cs = calls(f);
    expect(cs.length).toBeGreaterThan(1);
    for (const c of cs) {
      expect(new TextEncoder().encode(c.init.body as string).length).toBeLessThanOrEqual(LIMITS.ingestMaxBytes);
      expect(JSON.parse(c.init.body as string).items.length).toBeLessThanOrEqual(50);
    }
    expect(await queueLen()).toBe(0);
  });
  it("token only on ingest across modules", async () => {
    await seedConfig();
    await chrome.storage.local.set({ queue: [obs(1)] });
    const f = stubFetch((u) => (u.includes("/ingest/observations") ? ok(1) : u.includes("/verdict") ? err(404, "TWR-FCK-013") : u.includes("/badges/lookup") ? json({ accounts: {} }) : u.includes("reports") ? json({}, 201) : undefined));
    await flush();
    await getVerdicts(["1"], "fr");
    await lookupBadges(["1"]);
    await submitBadgeReport({ account: { platform: "x", external_id: "1" }, reason: "other" });
    for (const c of calls(f)) {
      const has = "X-Installation-Token" in headersOf(c.init);
      expect(has).toBe(c.url.endsWith("/v1/ingest/observations"));
    }
  });
  it("202 removes the batch even when items were rejected", async () => {
    await seedConfig();
    stubFetch(() => json({ accepted: 1, new: 1, duplicates: 0, rejected: 1, errors: [{ index: 1, code: "TWR-ING-003" }] }, 202));
    await chrome.storage.local.set({ queue: [obs(1), obs(2)] });
    await flush();
    expect(await queueLen()).toBe(0);
    expect((await getStatus()).sentToday).toBe(1);
  });
  it("resets sentToday on a new UTC day", async () => {
    await seedConfig();
    stubFetch(() => ok(1));
    await chrome.storage.local.set({ queue: [obs(1)] });
    await flush();
    expect((await getStatus()).sentToday).toBe(1);
    vi.setSystemTime(T0 + 24 * 3600_000);
    expect((await getStatus()).sentToday).toBe(0);
  });
  it("TWR-ING-002 clears queue and suspends until next 00:00 UTC", async () => {
    await seedConfig();
    const f = stubFetch(() => err(429, "TWR-ING-002"));
    await chrome.storage.local.set({ queue: [obs(1), obs(2)] });
    await flush();
    expect(await queueLen()).toBe(0);
    const st = await getStatus();
    expect(st.state).toBe("quota");
    expect(st.resumeAt).toBe("2026-06-11T00:00:00.000Z");
    expect((await enqueue([obs(9)])).queued).toBe(0);
    await chrome.storage.local.set({ queue: [obs(3)] });
    await flush();
    expect(f).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.UTC(2026, 5, 11, 0, 0, 1));
    expect((await enqueue([obs(10)])).queued).toBe(1);
  });
  it("local quota suspends", async () => {
    await seedConfig();
    await chrome.storage.local.set({ sendState: { sentToday: LIMITS.dailyQuota, sentDate: "2026-06-10" }, queue: [obs(1)] });
    const f = stubFetch(() => ok(1));
    await flush();
    expect(f).not.toHaveBeenCalled();
    expect((await getStatus()).state).toBe("quota");
  });
  it("TWR-ING-007 backs off 30s then grows, capped at 30 min", async () => {
    await seedConfig();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const f = stubFetch(() => err(429, "TWR-ING-007"));
    await chrome.storage.local.set({ queue: [obs(1)] });
    await flush();
    let st = await getStatus();
    expect(st.state).toBe("offline");
    expect(Date.parse(st.resumeAt!) - Date.now()).toBe(30_000);
    await flush(); // still backing off: no call
    expect(f).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 30_001);
    await flush();
    st = await getStatus();
    expect(Date.parse(st.resumeAt!) - Date.now()).toBe(60_000);
    for (let i = 0; i < 12; i++) { vi.setSystemTime(Date.now() + 31 * 60_000); await flush(); }
    st = await getStatus();
    expect(Date.parse(st.resumeAt!) - Date.now()).toBe(30 * 60_000);
    expect(await queueLen()).toBe(1);
    vi.mocked(Math.random).mockRestore();
  });
  it("TWR-ING-003 splits and drops a single refused item", async () => {
    await seedConfig();
    const f = stubFetch((_u, init) => {
      const items = JSON.parse(init.body as string).items as { external_id: string }[];
      return items.some((i) => i.external_id === "3") ? err(422, "TWR-ING-003") : ok(items.length);
    });
    await chrome.storage.local.set({ queue: [obs(1), obs(2), obs(3), obs(4)] });
    await flush();
    expect(await queueLen()).toBe(0);
    expect(f.mock.calls.length).toBeGreaterThan(2);
    expect((await getStatus()).sentToday).toBe(3);
  });
  it("413 TWR-ING-004 splits too", async () => {
    await seedConfig();
    stubFetch((_u, init) => {
      const items = JSON.parse(init.body as string).items as unknown[];
      return items.length > 1 ? err(413, "TWR-ING-004") : ok(1);
    });
    await chrome.storage.local.set({ queue: [obs(1), obs(2), obs(3)] });
    await flush();
    expect(await queueLen()).toBe(0);
    expect((await getStatus()).sentToday).toBe(3);
  });
  it("503 TWR-ING-010 and network errors keep the queue", async () => {
    await seedConfig();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    stubFetch(() => err(503, "TWR-ING-010"));
    await chrome.storage.local.set({ queue: [obs(1)] });
    await flush();
    expect(await queueLen()).toBe(1);
    expect(Date.parse((await getStatus()).resumeAt!) - Date.now()).toBe(60_000);
    await chrome.storage.local.remove("sendState");
    stubFetch(() => undefined);
    await flush();
    expect(await queueLen()).toBe(1);
    expect(Date.parse((await getStatus()).resumeAt!) - Date.now()).toBe(30_000);
    vi.mocked(Math.random).mockRestore();
  });
  it("other 4xx drops the batch", async () => {
    await seedConfig();
    stubFetch(() => err(400, "TWR-XXX-001"));
    await chrome.storage.local.set({ queue: [obs(1)] });
    await flush();
    expect(await queueLen()).toBe(0);
  });
  it("drops items older than 23 h", async () => {
    await seedConfig();
    const f = stubFetch((_u, init) => ok(JSON.parse(init.body as string).items.length));
    const old = new Date(T0 - 24 * 3600_000).toISOString();
    await chrome.storage.local.set({ queue: [obs(1, { observed_at: old }), obs(2)] });
    await flush();
    const sent = JSON.parse(calls(f)[0]!.init.body as string).items;
    expect(sent.map((i: { external_id: string }) => i.external_id)).toEqual(["2"]);
  });
  it("does nothing when sending is off", async () => {
    await seedConfig();
    await updateSettings({ sendObservations: false });
    await chrome.storage.local.set({ queue: [obs(1)] });
    const f = stubFetch(() => ok(1));
    await flush();
    expect(f).not.toHaveBeenCalled();
    expect((await getStatus()).state).toBe("paused");
  });
  it("status no_filters", async () => {
    expect((await getStatus()).state).toBe("no_filters");
  });
});
