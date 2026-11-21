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
  const account: BadgeAccount = {
    category: "organization", color: "#FFBF00", badge: null,
    affiliation: { org: { label: "Le Monde", logo_url: "https://cdn.example/logo.png" }, title: "Journaliste" },
  };
  it("labels affiliation badges, colours organisations in raspberry, and opens the popover", async () => {
    setTranslator(createTranslator("fr"));
    setTheme("light");
    const host = createBadge(account, "42");
    document.body.append(host);
    const btn = host.shadowRoot!.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Badge Seat 12A : Journaliste · Le Monde");
    expect(host.getAttribute("data-theme")).toBe("light");
    expect(host.shadowRoot!.querySelector("path")!.getAttribute("fill")).toBe("#E30B5C");
    expect(host.shadowRoot!.querySelector("path")!.getAttribute("stroke")).toBeNull();
    setTheme("dark");
    expect(host.shadowRoot!.querySelector("path")!.getAttribute("fill")).toBe("#E30B5C");

    chromeMock.messageHandler = (m) => (m.type === "getAccountDetail" ? { ...account, platform: "x", external_id: "42", affiliations: [account.affiliation] } : { ok: true });
    btn.click();
    await Promise.resolve(); await Promise.resolve();
    const overlay = document.querySelector("seat12a-overlay")!.shadowRoot!;
    const card = overlay.querySelector(".card")!;
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.querySelector("button[aria-label*='×'], .x")).toBeNull(); // no close cross
    expect(card.querySelector(".card-foot strong")!.textContent).toBe("Seat 12A");
    const actions = Array.from(card.querySelectorAll<HTMLButtonElement>(".card-foot button.ib"));
    expect(actions).toHaveLength(2);
    for (const b of actions) expect(b.getAttribute("aria-label")).toBe(b.getAttribute("title"));
    actions[0]!.click();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ type: "openOptions", hash: "request?account=42" });
    expect(overlay.querySelector(".card")).toBeNull();
  });
  it("explains why the account is verified instead of repeating its name", async () => {
    setTranslator(createTranslator("fr"));
    const media: BadgeAccount = { category: "media", color: "#D946EF", badge: { category: "media", color: "#D946EF", label: "Le Monde" }, affiliation: null };
    const host = createBadge(media, "24744541");
    document.body.append(host);
    const btn = host.shadowRoot!.querySelector("button")!;
    btn.dispatchEvent(new MouseEvent("mouseenter"));
    const overlay = document.querySelector("seat12a-overlay")!.shadowRoot!;
    const tip = overlay.querySelector(".tip")!.textContent!;
    expect(tip).toContain("Ce compte est certifié car c'est un média.");
    expect(tip).not.toContain("Le Monde");
    chromeMock.messageHandler = () => null;
    btn.click();
    await Promise.resolve(); await Promise.resolve();
    expect(overlay.querySelector(".card-sub")!.textContent).toBe("Ce compte est certifié car c'est un média.");
    expect(overlay.querySelector(".card")!.textContent).not.toContain("Le Monde");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // Affiliation: the reason names the organisation.
    const tip2 = createBadge(account, "42");
    document.body.append(tip2);
    tip2.shadowRoot!.querySelector("button")!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(overlay.querySelector(".tip")!.textContent).toContain("Ce compte est certifié car il est affilié à Le Monde (Journaliste).");
  });
  it("closes on Escape", async () => {
    const host = createBadge(account, "42");
    document.body.append(host);
    chromeMock.messageHandler = () => null;
    host.shadowRoot!.querySelector("button")!.click();
    const overlay = document.querySelector("seat12a-overlay")!.shadowRoot!;
    expect(overlay.querySelector(".card")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(overlay.querySelector(".card")).toBeNull();
    vi.clearAllMocks();
  });
});
