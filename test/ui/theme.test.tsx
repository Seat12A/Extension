import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { updateSettings } from "~/shared/settings";
import { ThemeProvider } from "@/theme";
import { mount, flush } from "./helpers";

function stubMatchMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const mq = { matches: dark, addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) };
  vi.stubGlobal("matchMedia", () => mq);
  return { flip: (v: boolean) => { mq.matches = v; listeners.forEach((l) => l()); } };
}
afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute("data-theme"); });

const theme = () => document.documentElement.getAttribute("data-theme");

describe("ThemeProvider", () => {
  it("applies explicit light and dark", async () => {
    stubMatchMedia(true);
    await updateSettings({ theme: "light" });
    const m = await mount(<div />, { providers: false });
    m.unmount();
    const a = await mount(<ThemeProvider><div /></ThemeProvider>, { providers: false });
    expect(theme()).toBe("light");
    await act(async () => { await updateSettings({ theme: "dark" }); });
    await flush();
    expect(theme()).toBe("dark");
    a.unmount();
  });
  it("system follows prefers-color-scheme live", async () => {
    const mm = stubMatchMedia(false);
    const a = await mount(<ThemeProvider><div /></ThemeProvider>, { providers: false });
    expect(theme()).toBe("light");
    await act(async () => { mm.flip(true); });
    expect(theme()).toBe("dark");
    a.unmount();
  });
});
