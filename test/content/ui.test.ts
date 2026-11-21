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
