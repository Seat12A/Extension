import { describe, expect, it } from "vitest";
import { normalizeAccountDetail } from "~/background/badges";

// Real response of GET https://api.seat12a.org/v1/badges/accounts/x/1976143068 (2026-11-16).
const REAL = {
  account: { platform: "x", external_id: "1976143068" },
  badge: {
    public_id: "222935be-2944-4c8c-812b-3ae66c341ea0",
    account: { platform: "x", external_id: "1976143068" },
    status: "active", category: "institutional", color: "#FF7A00", label: "Emmanuel Macron", logo_url: null,
  },
  affiliations: [],
};

describe("normalizeAccountDetail", () => {
  it("maps Tower's nested shape to the displayed category/colour", () => {
    expect(normalizeAccountDetail(REAL, "1976143068")).toEqual({
      platform: "x", external_id: "1976143068", category: "institutional", color: "#FF7A00",
      badge: { category: "institutional", color: "#FF7A00", label: "Emmanuel Macron" },
      affiliation: null, affiliations: [],
    });
  });

  it("falls back to the main affiliation when the account has no own badge", () => {
    const d = normalizeAccountDetail({
      account: { platform: "x", external_id: "9" }, badge: null,
      affiliations: [{ org: { label: "Le Monde", logo_url: "https://x/y.png", category: "media", color: "#D946EF" }, title: "Journaliste" }],
    }, "9");
    expect(d).toMatchObject({ category: "media", color: "#D946EF", badge: null, affiliation: { org: { label: "Le Monde" }, title: "Journaliste" } });
  });

  it("ignores an inactive badge and returns null when nothing is displayable", () => {
    expect(normalizeAccountDetail({ ...REAL, badge: { ...REAL.badge, status: "revoked" } }, "1976143068")).toBeNull();
    expect(normalizeAccountDetail(null, "1")).toBeNull();
  });

  it("still accepts the flat lookup-like shape", () => {
    expect(normalizeAccountDetail({ category: "expert", color: "#00A0C0", badge: null, affiliation: null }, "5")).toMatchObject({ category: "expert", external_id: "5" });
  });
});
