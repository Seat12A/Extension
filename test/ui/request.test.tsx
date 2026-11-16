import { beforeEach, describe, expect, it } from "vitest";
import { chromeMock } from "../chrome-mock";
import { buildRequestBody, validateRequest, type RequestValues } from "../../src/options/sections/request-logic";
import { RequestSection } from "../../src/options/sections/request";
import { mount, submit, type } from "./helpers";

const valid: RequestValues = {
  kind: "badge", accountId: "123456", category: "media", orgId: "", orgTitle: "",
  justification: "Rédaction nationale reconnue, compte officiel du média.", contact: "", evidence: "",
};

describe("validateRequest", () => {
  it("accepts a valid badge request", () => expect(validateRequest(valid)).toEqual({}));
  it("rejects a bad account id", () => {
    expect(validateRequest({ ...valid, accountId: "abc" }).accountId).toBeDefined();
    expect(validateRequest({ ...valid, accountId: "1".repeat(21) }).accountId).toBeDefined();
    expect(validateRequest({ ...valid, accountId: "" }).accountId).toBeDefined();
  });
  it("rejects a short justification", () => expect(validateRequest({ ...valid, justification: "trop court" }).justification).toBeDefined());
  it("rejects non-https evidence", () => expect(validateRequest({ ...valid, evidence: "https://a.fr\nhttp://b.fr" }).evidence).toBe("options_error_evidence_https"));
  it("rejects more than 10 urls", () => {
    const evidence = Array.from({ length: 11 }, (_, i) => `https://e.fr/${i}`).join("\n");
    expect(validateRequest({ ...valid, evidence }).evidence).toBe("options_error_evidence_count");
  });
  it("requires org id and title for affiliations", () => {
    const e = validateRequest({ ...valid, kind: "affiliation" });
    expect(e.orgId).toBeDefined();
    expect(e.orgTitle).toBeDefined();
  });
});

describe("buildRequestBody", () => {
  it("builds a badge body", () => {
    expect(buildRequestBody({ ...valid, contact: " a@b.fr ", evidence: "https://a.fr\n\n https://b.fr " })).toEqual({
      kind: "badge", account: { platform: "x", external_id: "123456" }, category: "media",
      justification: valid.justification, contact: "a@b.fr", evidence_urls: ["https://a.fr", "https://b.fr"],
    });
  });
  it("builds an affiliation body", () => {
    expect(buildRequestBody({ ...valid, kind: "affiliation", orgId: "99", orgTitle: "Porte-parole" })).toEqual({
      kind: "affiliation", account: { platform: "x", external_id: "123456" }, org: { platform: "x", external_id: "99" },
      title: "Porte-parole", justification: valid.justification,
    });
  });
});

describe("RequestSection form", () => {
  let sent: any[];
  beforeEach(() => {
    sent = [];
    chromeMock.messageHandler = (m) => {
      if (m.type === "getBadgeCategories") return [];
      sent.push(m);
      return { ok: true };
    };
  });

  it("shows inline errors and sends nothing when invalid", async () => {
    const m = await mount(<RequestSection />);
    await submit(m.container.querySelector("form")!);
    expect(sent).toHaveLength(0);
    const invalid = m.container.querySelectorAll('[aria-invalid="true"]');
    expect(invalid.length).toBeGreaterThanOrEqual(2);
    for (const el of invalid) expect(document.getElementById(el.getAttribute("aria-describedby")!.split(" ").at(-1)!)).not.toBeNull();
    m.unmount();
  });

  it("sends the exact body when valid and shows success", async () => {
    const m = await mount(<RequestSection initialAccount="777" />);
    const ta = m.container.querySelectorAll("textarea");
    await type(ta[0] as HTMLTextAreaElement, valid.justification);
    await type(ta[1] as HTMLTextAreaElement, "https://exemple.fr/preuve");
    await submit(m.container.querySelector("form")!);
    expect(sent).toEqual([{
      type: "submitBadgeRequest",
      body: { kind: "badge", account: { platform: "x", external_id: "777" }, category: "personality",
        justification: valid.justification, evidence_urls: ["https://exemple.fr/preuve"] },
    }]);
    expect(m.container.textContent).toContain("Demande envoyée");
    m.unmount();
  });

  it("disables submit after TWR-BDG-019", async () => {
    chromeMock.messageHandler = (m) => (m.type === "getBadgeCategories" ? [] : { ok: false, code: "TWR-BDG-019" });
    const m = await mount(<RequestSection initialAccount="777" />);
    await type(m.container.querySelector("textarea")!, valid.justification);
    await submit(m.container.querySelector("form")!);
    expect((m.container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(m.container.textContent).toContain("minute");
    m.unmount();
  });
});
