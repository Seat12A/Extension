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
      badge: { category: "institutional", color: "#FF7A00", label: "Emmanuel Macron", expertise: null },
      affiliation: null, affiliations: [],
    });
  });

  it("an affiliated-only account gets no check: category/colour stay null, the org keeps its own", () => {
    const d = normalizeAccountDetail({
      account: { platform: "x", external_id: "9" }, badge: null,
      affiliations: [
        { primary: false, org: { label: "Université X", logo_url: null, category: "organization", status: "active" }, title: null },
        { primary: true, org: { label: "Le Monde", logo_url: "https://x/y.png", category: "media", color: "#D946EF", status: "active" }, title: "Journaliste" },
        { primary: false, org: { label: "Ancien", status: "suspended" }, title: null },
      ],
    }, "9");
    expect(d).toMatchObject({ category: null, color: null, badge: null, affiliation: { org: { label: "Le Monde", category: "media" }, title: "Journaliste" } });
    expect(d!.affiliations.map((a) => a.org.label)).toEqual(["Le Monde", "Université X"]);
  });

  it("an affiliate's own badge may differ from its organisation's (journalist verified at a media)", () => {
    const d = normalizeAccountDetail({
      account: { platform: "x", external_id: "9" },
      badge: { status: "active", category: "verified", color: "#3B5BFF", label: "J", expertise: null },
      affiliations: [{ primary: true, org: { label: "Le Monde", category: "media", color: "#D946EF", status: "active" }, title: "Journaliste" }],
    }, "9");
    expect(d).toMatchObject({ category: "verified", color: "#3B5BFF", affiliation: { org: { category: "media" } } });
  });

  it("ignores an inactive badge and returns null when nothing is displayable", () => {
    expect(normalizeAccountDetail({ ...REAL, badge: { ...REAL.badge, status: "revoked" } }, "1976143068")).toBeNull();
    expect(normalizeAccountDetail(null, "1")).toBeNull();
  });

  it("flat shape: a top-level category without any `badge` key still means a badge, `badge: null` never does", () => {
    expect(normalizeAccountDetail({ category: "expert", color: "#16A34A" }, "5")).toMatchObject({ category: "expert", external_id: "5", badge: { category: "expert" } });
    expect(normalizeAccountDetail({ category: "expert", color: "#16A34A", badge: null, affiliation: null }, "5")).toBeNull();
  });
});
