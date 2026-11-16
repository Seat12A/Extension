import { describe, expect, it } from "vitest";
import { StatusCard } from "@/components/status-card";
import type { ExtensionStatus } from "~/shared/messages";
import { mount } from "./helpers";

const base: ExtensionStatus = { state: "active", queueSize: 0, sentToday: 12, resumeAt: null, filterVersion: "v1", lastSyncAt: null };
const title = (c: HTMLElement) => c.querySelector('[data-testid="status-title"]')?.textContent;
const desc = (c: HTMLElement) => c.querySelector('[data-testid="status-desc"]')?.textContent ?? "";

describe("StatusCard", () => {
  it.each([
    ["active", "Actif"],
    ["paused", "Envoi en pause"],
    ["quota", "Quota du jour atteint"],
    ["offline", "Seat 12A injoignable"],
    ["no_filters", "Aucun filtre actif"],
  ] as const)("%s", async (state, expected) => {
    const m = await mount(<StatusCard status={{ ...base, state, resumeAt: "2026-01-01T10:30:00Z" }} />);
    expect(title(m.container)).toBe(expected);
    m.unmount();
  });

  it("describes sent count and queue", async () => {
    const m = await mount(<StatusCard status={{ ...base, queueSize: 3 }} />);
    expect(desc(m.container)).toContain("12 posts remontés");
    expect(desc(m.container)).toContain("3 en attente");
    m.unmount();
  });
  it("uses the singular", async () => {
    const m = await mount(<StatusCard status={{ ...base, sentToday: 1 }} />);
    expect(desc(m.container)).toContain("1 post remonté");
    m.unmount();
  });
  it("shows a skeleton while loading and a message on failure", async () => {
    const m = await mount(<StatusCard status={null} />);
    expect(title(m.container)).toBeUndefined();
    expect(m.container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    m.unmount();
    const f = await mount(<StatusCard status={null} failed />);
    expect(title(f.container)).toBe("Statut indisponible");
    f.unmount();
  });
});
