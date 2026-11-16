import { applyStyles, createHost, h, isolateEvents } from "./dom";
import { registerWidget } from "./state";
import { BASE_CSS, OVERLAY_CSS } from "./styles";

export interface Overlay { host: HTMLElement; root: ShadowRoot; tip: HTMLElement; layer: HTMLElement }
let overlay: Overlay | null = null;

/** One shared, body-level host for tooltips and the popover (so X's overflow:hidden rows cannot clip them). */
export function getOverlay(): Overlay {
  if (overlay && overlay.host.isConnected) return overlay;
  const { host, root } = createHost("seat12a-overlay");
  applyStyles(root, BASE_CSS + OVERLAY_CSS);
  const tip = h("div", { class: "tip", role: "tooltip" });
  const layer = h("div", { class: "layer" });
  root.append(tip, layer);
  isolateEvents(layer);
  registerWidget(host, () => {});
  (document.body ?? document.documentElement).append(host);
  overlay = { host, root, tip, layer };
  return overlay;
}

/** Fixed-position placement near `anchor`, preferring above (`prefer`), flipping when short of room. */
export function place(el: HTMLElement, anchor: Element, prefer: "above" | "below", width: number, align: "center" | "start" = "center"): void {
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const height = el.offsetHeight || 60;
  const gap = 8;
  let above = prefer === "above";
  if (above && r.top - height - gap < 0) above = false;
  if (!above && r.bottom + height + gap > vh && r.top - height - gap >= 0) above = true;
  const top = above ? r.top - height - gap : r.bottom + gap;
  const want = align === "start" ? r.left - 12 : r.left + r.width / 2 - width / 2;
  const left = Math.max(8, Math.min(want, vw - width - 8));
  el.style.top = `${Math.max(8, top)}px`;
  el.style.left = `${left}px`;
}
