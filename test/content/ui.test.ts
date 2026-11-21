import { afterEach, describe, expect, it, vi } from "vitest";
import type { BadgeAccount } from "~/shared/api-types";
import { createTranslator } from "~/shared/i18n";
import { detectTheme } from "~/content/theme";
import { createBadge } from "~/content/ui/badge";
import { setTheme, setTranslator } from "~/content/ui/state";
import { chromeMock } from "../chrome-mock";

afterEach(() => { document.body.innerHTML = ""; document.body.removeAttribute("style"); });

describe("detectTheme", () => {
  it.each([["rgb(255, 255, 255)", "light"], ["rgb(21, 32, 43)", "dim"], ["rgb(0, 0, 0)", "dark"], ["rgb(240, 240, 240)", "light"], ["rgb(30, 30, 60)", "dark"]])("%s → %s", (bg, theme) => {
    document.body.style.backgroundColor = bg;
    expect(detectTheme()).toBe(theme);
  });
});

describe("badge widget", () => {
  const leMonde = { platform: "x" as const, external_id: "111", label: "Le Monde", logo_url: "https://cdn.example/logo.png", category: "media", color: "#D946EF" };
  // Affiliated only: no own badge → logo, no check (Tower, 2026-11-21).
  const affiliate: BadgeAccount = {
    category: null, color: null, badge: null,
    affiliation: { org: leMonde, title: "Journaliste" },
    affiliations: [{ org: leMonde, title: "Journaliste" }, { org: { label: "Université X", logo_url: null }, title: null }],
  };
  const org: BadgeAccount = { category: "organization", color: "#FFD60A", badge: { category: "organization", color: "#FFD60A", label: "Seat 12A", expertise: null }, affiliation: null, affiliations: [] };
  const overlay = () => document.querySelector("seat12a-overlay")!.shadowRoot!;
  const hover = (host: HTMLElement) => host.shadowRoot!.querySelector("button")!.dispatchEvent(new MouseEvent("mouseenter"));
  const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

  it("own badge: raspberry seal for organisations, accessible name, popover actions", async () => {
    setTranslator(createTranslator("fr"));
    setTheme("light");
    const host = createBadge(org, "42");
    document.body.append(host);
    const btn = host.shadowRoot!.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Badge Seat 12A : Organisation");
    expect(host.getAttribute("data-theme")).toBe("light");
    expect(host.shadowRoot!.querySelector(".seal path")!.getAttribute("fill")).toBe("#E30B5C");
    expect(host.shadowRoot!.querySelector(".org")).toBeNull();
    setTheme("dark");
    expect(host.shadowRoot!.querySelector(".seal path")!.getAttribute("fill")).toBe("#E30B5C");

    chromeMock.messageHandler = (m) => (m.type === "getAccountDetail" ? { ...org, platform: "x", external_id: "42" } : { ok: true });
    host.shadowRoot!.querySelector("button")!.click();
    await tick();
    const card = overlay().querySelector(".card")!;
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.querySelector(".card-foot strong")!.textContent).toBe("Seat 12A");
    const actions = Array.from(card.querySelectorAll<HTMLButtonElement>(".card-foot button.ib"));
    expect(actions).toHaveLength(2);
    for (const b of actions) expect(b.getAttribute("aria-label")).toBe(b.getAttribute("title"));
    actions[0]!.click();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ type: "openOptions", hash: "request?account=42" });
    expect(overlay().querySelector(".card")).toBeNull();
  });

  it("affiliated only: organisation logo next to the name, never a check", async () => {
    setTranslator(createTranslator("fr"));
    setTheme("light");
    const host = createBadge(affiliate, "9");
    document.body.append(host);
    const root = host.shadowRoot!;
    expect(root.querySelector(".seal")).toBeNull();
    expect(root.querySelector("img.org")!.getAttribute("src")).toBe("https://cdn.example/logo.png");
    expect(root.querySelector("button")!.getAttribute("aria-label")).toBe("Affilié à Le Monde");
    hover(host);
    const tip = overlay().querySelector(".tip")!;
    expect(tip.textContent).toContain("Affiliations");
    expect(tip.textContent).toContain("Le Monde · Journaliste");
    expect(tip.textContent).toContain("Université X");
    expect(tip.textContent).not.toContain("certifié");
    expect(tip.querySelector(".initial")!.textContent).toBe("U"); // no logo → initial
    chromeMock.messageHandler = () => null;
    root.querySelector("button")!.click();
    await tick();
    const card = overlay().querySelector(".card")!;
    expect(card.querySelector(".card-head")).toBeNull();
    expect(card.querySelectorAll(".aff")).toHaveLength(2);
  });

  it("badge + affiliation: seal AND logo; a missing logo falls back to the initial", () => {
    setTranslator(createTranslator("fr"));
    const both: BadgeAccount = {
      ...affiliate, category: "verified", color: "#3B5BFF",
      badge: { category: "verified", color: "#3B5BFF", label: "J", expertise: null },
      affiliation: { org: { label: "université X", logo_url: null }, title: null },
    };
    const host = createBadge(both, "9");
    document.body.append(host);
    const root = host.shadowRoot!;
    expect(root.querySelector(".seal")).not.toBeNull();
    expect(root.querySelector(".org.initial")!.textContent).toBe("U");
    expect(root.querySelector("button")!.getAttribute("aria-label")).toBe("Badge Seat 12A : Vérifié · Affilié à université X");
  });

  it("explains why the account is verified instead of repeating its name; expert field in the title", async () => {
    setTranslator(createTranslator("fr"));
    const media: BadgeAccount = { category: "media", color: "#D946EF", badge: { category: "media", color: "#D946EF", label: "Le Monde", expertise: null }, affiliation: null, affiliations: [] };
    const host = createBadge(media, "24744541");
    document.body.append(host);
    hover(host);
    const tip = overlay().querySelector(".tip")!.textContent!;
    expect(tip).toContain("Ce compte est certifié car c'est un média.");
    expect(tip).not.toContain("Le Monde");
    chromeMock.messageHandler = () => null;
    host.shadowRoot!.querySelector("button")!.click();
    await tick();
    expect(overlay().querySelector(".card-sub")!.textContent).toBe("Ce compte est certifié car c'est un média.");
    expect(overlay().querySelector(".card")!.textContent).not.toContain("Le Monde");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    const expert: BadgeAccount = { category: "expert", color: "#16A34A", badge: { category: "expert", color: "#16A34A", label: "Dr A", expertise: "épidémiologie" }, affiliation: null, affiliations: [] };
    const h2 = createBadge(expert, "7");
    document.body.append(h2);
    hover(h2);
    expect(overlay().querySelector(".tip .l1")!.textContent).toBe("Expert · épidémiologie");
  });

  it("closes on Escape", async () => {
    const host = createBadge(org, "42");
    document.body.append(host);
    chromeMock.messageHandler = () => null;
    host.shadowRoot!.querySelector("button")!.click();
    expect(overlay().querySelector(".card")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay().querySelector(".card")).toBeNull();
    vi.clearAllMocks();
  });
});
