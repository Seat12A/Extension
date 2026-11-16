import { describe, expect, it } from "vitest";
import type { IngestConfig } from "~/shared/api-types";
import { passesFilters } from "~/content/filter";

const cfg = (over: Partial<IngestConfig["filters"]> = {}, version: string | null = "v1"): IngestConfig => ({
  version,
  filters: { keywords: [], accounts: [], thresholds: {}, ...over },
});

describe("passesFilters", () => {
  it("fails without config or version", () => {
    expect(passesFilters({ text: "vaccin" }, null)).toBe(false);
    expect(passesFilters({ text: "vaccin" }, undefined)).toBe(false);
    expect(passesFilters({ text: "vaccin" }, cfg({ keywords: ["vaccin"] }, null))).toBe(false);
  });
  it("single keyword matches whole words only", () => {
    const c = cfg({ keywords: ["vaccin"] });
    expect(passesFilters({ text: "Le VACCIN, oui !" }, c)).toBe(true);
    expect(passesFilters({ text: "les vaccinations" }, c)).toBe(false);
  });
  it("expressions match as substrings", () => {
    const c = cfg({ keywords: ["puce électronique"] });
    expect(passesFilters({ text: "Une PUCE   électronique dans le bras" }, c)).toBe(true);
    expect(passesFilters({ text: "une puce" }, c)).toBe(false);
  });
  it("normalises NFKC and case", () => {
    const c = cfg({ keywords: ["ＣＯＶＩＤ"] });
    expect(passesFilters({ text: "covid-19" }, c)).toBe(true);
    expect(passesFilters({ text: "ﬁnance" }, cfg({ keywords: ["finance"] }))).toBe(true);
  });
  it("matches by author id", () => {
    const c = cfg({ accounts: [{ platform: "x", external_id: "42" }] });
    expect(passesFilters({ text: "rien" }, c, "42")).toBe(true);
    expect(passesFilters({ text: "rien" }, c, "43")).toBe(false);
    expect(passesFilters({ text: "rien" }, c)).toBe(false);
  });
  it("applies thresholds after a match; missing metric fails; unknown keys ignored", () => {
    const c = cfg({ keywords: ["x"], thresholds: { min_likes: 10, min_views: 100, whatever: 5 } });
    expect(passesFilters({ text: "x", metrics: { likes: 10, views: 100 } }, c)).toBe(true);
    expect(passesFilters({ text: "x", metrics: { likes: 9, views: 100 } }, c)).toBe(false);
    expect(passesFilters({ text: "x", metrics: { likes: 10 } }, c)).toBe(false);
    expect(passesFilters({ text: "x" }, c)).toBe(false);
    expect(passesFilters({ text: "y", metrics: { likes: 99, views: 999 } }, c)).toBe(false);
    expect(passesFilters({ text: "x" }, cfg({ keywords: ["x"], thresholds: { unknown: 1 } }))).toBe(true);
  });
  it("empty filters never match", () => expect(passesFilters({ text: "anything" }, cfg())).toBe(false));
});
