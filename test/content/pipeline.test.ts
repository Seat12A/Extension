import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IngestConfig, ObservationItem, PublicVerdict, BadgeAccount } from "~/shared/api-types";
import { DEFAULT_SETTINGS } from "~/shared/settings";
import { resetAuthorIds } from "~/content/author-ids";
import { startApp, type App } from "~/content/app";
import { chromeMock } from "../chrome-mock";
import { load } from "./helpers";

const ALLOWED = new Set(["platform", "external_id", "url", "author", "text", "lang_hint", "created_at", "observed_at", "metrics", "quoted_external_id", "parent_external_id", "media", "filter_version"]);

const config: IngestConfig = { version: "v7", filters: { keywords: ["impôts", "vaccin", "chômage"], accounts: [], thresholds: {} } };
const verdict = (id: string): PublicVerdict => ({
  platform: "x", external_id: id, url: "https://seat12a.example/cases/1", lang: "fr",
  claims: [{ text: "Les impôts baissent de 10 %", lang: "fr", veracity: "false", context_need: "necessary", context_types: [], validated_at: "2026-11-10T10:00:00Z", note: { lang: "fr", text: "Faux : la baisse est de 1 %.", machine_translated: false, links: ["https://example.org/a", "http://insecure.example/b"] }, inherited: null }],
});
const expert: BadgeAccount = { category: "expert", color: "#00A0C0", badge: { category: "expert", color: "#00A0C0", label: "Épidémiologiste" }, affiliation: null };

let sent: any[] = [];
let app: App | null = null;
const flush = async (ms = 400) => { await vi.advanceTimersByTimeAsync(ms); };

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  window.history.pushState({}, "", "/home");
  resetAuthorIds();
  document.documentElement.className = "";
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("XMLHttpRequest", vi.fn());
  chromeMock.messageHandler = (msg) => {
    sent.push(JSON.parse(JSON.stringify(msg)));
    switch (msg.type) {
      case "getConfig": return config;
      case "observe": return { queued: msg.items.length };
      case "getVerdicts": return Object.fromEntries(msg.ids.map((id: string) => [id, id.endsWith("101") ? verdict(id) : null]));
      case "lookupBadges": return Object.fromEntries(msg.ids.map((id: string) => [id, id === "555" ? expert : null]));
      default: return undefined;
    }
  };
});
afterEach(() => {
  app?.stop();
  app = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

async function boot() {
  app = await startApp();
  await flush(4000);
}

describe("pipeline", () => {
  it("sends only filtered posts with a minimal payload and never anything about the user", async () => {
    load("timeline.html");
    await boot();
    const obs = sent.filter((m) => m.type === "observe").flatMap((m) => m.items as ObservationItem[]);
    expect(obs.map((o) => o.external_id).sort()).toEqual(["1850000000000000101", "1850000000000000103", "1850000000000000105"]);
    for (const o of obs) {
      expect(Object.keys(o).every((k) => ALLOWED.has(k))).toBe(true);
      expect(o.platform).toBe("x");
      expect(o.filter_version).toBe("v7");
      expect(o.url).toBe(`https://x.com/${o.author.handle}/status/${o.external_id}`);
      expect(Object.keys(o.author).every((k) => ["handle", "external_id", "display_name"].includes(k))).toBe(true);
    }
    const quote = obs.find((o) => o.external_id.endsWith("105"))!;
    expect(quote.quoted_external_id).toBe("1849999999999999998");
    expect(quote.text).not.toContain("recule");
    expect(JSON.stringify(sent)).not.toMatch(/self_user/i);
    expect(sent.some((m) => ["lookupBadges", "getVerdicts", "observe"].includes(m.type) && JSON.stringify(m).includes("gina_private"))).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not send observations when sending is off but still asks verdicts", async () => {
    await chromeMock.storage.local.set({ settings: { ...DEFAULT_SETTINGS, sendObservations: false } });
    load("timeline.html");
    await boot();
    expect(sent.some((m) => m.type === "observe")).toBe(false);
    expect(sent.find((m) => m.type === "getVerdicts")!.ids).toEqual(["1850000000000000101", "1850000000000000103", "1850000000000000105"]);
  });

  it("requests each verdict once, batched, and renders only for posts that have one", async () => {
    load("timeline.html");
    await boot();
    const asks = sent.filter((m) => m.type === "getVerdicts");
    expect(asks).toHaveLength(1);
    expect(asks[0].lang).toBe("fr");
    const widgets = document.querySelectorAll("seat12a-verdict");
    expect(widgets).toHaveLength(1);
    const art = widgets[0]!.closest("article")!;
    expect(art.textContent).toContain("baisse des impôts");
    // inserted just before the action group, inside the content column
    expect(widgets[0]!.nextElementSibling?.querySelector('[data-testid="reply"]') ?? widgets[0]!.nextElementSibling?.matches('[role="group"]')).toBeTruthy();
    const root = widgets[0]!.shadowRoot!;
    expect(root.textContent).toContain("Faux");
    // re-adding the same article does not ask again
    const clone = art.cloneNode(true) as Element;
    clone.querySelector("seat12a-verdict")?.remove();
    document.querySelector('[data-testid="primaryColumn"] > div > div')!.append(clone);
    await flush(2000);
    expect(sent.filter((m) => m.type === "getVerdicts")).toHaveLength(1);
  });

  it("expands the verdict, links https only, and stops event propagation", async () => {
    load("timeline.html");
    await boot();
    const host = document.querySelector("seat12a-verdict")!;
    const row = host.shadowRoot!.querySelector<HTMLButtonElement>("button.row")!;
    const outer = vi.fn();
    document.body.addEventListener("click", outer);
    row.click();
    expect(outer).not.toHaveBeenCalled();
    expect(host.shadowRoot!.querySelector("button.row")!.getAttribute("aria-expanded")).toBe("true");
    const links = Array.from(host.shadowRoot!.querySelectorAll<HTMLAnchorElement>("a")).map((a) => a.href);
    expect(links).toContain("https://example.org/a");
    expect(links.some((l) => l.startsWith("http://"))).toBe(false);
    const note = host.shadowRoot!.querySelector(".note")!;
    expect(note.getAttribute("lang")).toBe("fr");
    expect(note.getAttribute("dir")).toBe("auto");
    document.body.removeEventListener("click", outer);
  });

  it("inserts a translated badge next to the name and toggles the checkmark class", async () => {
    load("timeline.html", "user-cell.html");
    document.querySelectorAll('[data-testid$="-follow"]')[0]!.setAttribute("data-testid", "555-follow");
    await boot();
    expect(document.documentElement.classList.contains("seat12a-badges")).toBe(true);
    const lookups = sent.filter((m) => m.type === "lookupBadges");
    expect(lookups.length).toBeGreaterThan(0);
    expect(lookups.flatMap((m) => m.ids)).toContain("555");
    const badge = document.querySelector('[data-testid="UserCell"] seat12a-badge')!;
    expect(badge).toBeTruthy();
    const btn = badge.shadowRoot!.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Badge Seat 12A : Expert");
    expect(document.querySelectorAll('[data-testid="UserCell"] seat12a-badge')).toHaveLength(1);
    // settings: badges off → class removed, badges removed
    await chromeMock.storage.local.set({ settings: { ...DEFAULT_SETTINGS, showBadges: false } });
    await flush(1000);
    expect(document.documentElement.classList.contains("seat12a-badges")).toBe(false);
    expect(document.querySelector("seat12a-badge")).toBeNull();
  });

  it("badge on a post once the author's id is known (learned from a user cell)", async () => {
    load("timeline.html");
    // ivan has an id known from a previous cell
    const cell = document.createElement("div");
    cell.innerHTML = '<div data-testid="UserCell"><a href="/ivan" role="link"><span>Ivan</span></a><a href="/ivan" role="link"><span>@ivan</span></a><button data-testid="555-follow"></button></div>';
    document.body.append(cell);
    await boot();
    const ivanPost = Array.from(document.querySelectorAll("article")).find((a) => a.textContent?.includes("climate report"))!;
    const badge = ivanPost.querySelector('[data-testid="User-Name"] seat12a-badge');
    expect(badge).toBeTruthy();
    expect(badge!.shadowRoot!.querySelector("button")!.getAttribute("aria-label")).toBe("Badge Seat 12A : Expert");
  });

  it("sends government hints only for grey checks with a known id", async () => {
    load("timeline.html");
    const cell = document.createElement("div");
    cell.innerHTML = '<div data-testid="UserCell"><a href="/elysee" role="link"><span>Élysée</span></a><a href="/elysee" role="link"><span>@elysee</span></a><button data-testid="777-follow"></button></div>';
    document.body.append(cell);
    await boot();
    await flush(6000);
    const hints = sent.filter((m) => m.type === "governmentHints");
    expect(hints).toHaveLength(1);
    expect(hints[0].ids).toEqual(["777"]);
  });

  it("ignores the user's own profile and unsupported pages", async () => {
    window.history.pushState({}, "", "/messages");
    load("timeline.html");
    await boot();
    expect(sent.some((m) => m.type === "observe" || m.type === "getVerdicts")).toBe(false);
    window.history.pushState({}, "", "/home");
  });

  it("makes no network call at all", async () => {
    load("timeline.html");
    await boot();
    expect(fetch).not.toHaveBeenCalled();
    expect(XMLHttpRequest).not.toHaveBeenCalled();
  });
});
