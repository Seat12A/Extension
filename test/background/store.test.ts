import { describe, expect, it, vi, afterEach } from "vitest";
import { getLocal, getSession, setLocal, setSession, ttlGet, ttlSetMany } from "~/background/store";

afterEach(() => vi.useRealTimers());

describe("store", () => {
  it("get/set with fallback", async () => {
    expect(await getLocal("a", 5)).toBe(5);
    await setLocal("a", 7);
    expect(await getLocal("a", 5)).toBe(7);
    await setSession("b", "x");
    expect(await getSession("b", "")).toBe("x");
  });
  it("expires entries after ttl and distinguishes cached null", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    await ttlSetMany("session", "m", { k: null, j: 1 }, 10);
    expect(await ttlGet("session", "m", "k", 1000)).toEqual({ v: null });
    expect(await ttlGet("session", "m", "zz", 1000)).toBeUndefined();
    vi.setSystemTime(1_001_500);
    expect(await ttlGet("session", "m", "k", 1000)).toBeUndefined();
  });
  it("evicts oldest beyond max", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    await ttlSetMany("local", "m", { a: 1 }, 2);
    vi.setSystemTime(2000);
    await ttlSetMany("local", "m", { b: 2 }, 2);
    vi.setSystemTime(3000);
    await ttlSetMany("local", "m", { c: 3 }, 2);
    expect(await ttlGet("local", "m", "a", 1e9)).toBeUndefined();
    expect((await ttlGet("local", "m", "b", 1e9))?.v).toBe(2);
    expect((await ttlGet("local", "m", "c", 1e9))?.v).toBe(3);
  });
});
