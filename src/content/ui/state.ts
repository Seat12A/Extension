import { createTranslator, type Translator } from "~/shared/i18n";
import type { PageTheme } from "~/shared/palette";

/** Shared UI context: current translator and X theme. Widgets re-render on change. */
export const ui: { t: Translator; theme: PageTheme } = { t: createTranslator("auto"), theme: "light" };

interface Widget { host: HTMLElement; render: () => void }
const widgets = new Set<Widget>();

export function registerWidget(host: HTMLElement, render: () => void): void {
  host.setAttribute("data-theme", ui.theme);
  if (widgets.size > 300) for (const w of Array.from(widgets)) if (!w.host.isConnected) widgets.delete(w);
  widgets.add({ host, render });
}

export function setTranslator(t: Translator): void { ui.t = t; }

export function setTheme(theme: PageTheme): void {
  ui.theme = theme;
  for (const w of Array.from(widgets)) {
    if (!w.host.isConnected) { widgets.delete(w); continue; }
    w.host.setAttribute("data-theme", theme);
    w.render();
  }
}
