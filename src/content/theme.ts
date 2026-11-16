import type { PageTheme } from "~/shared/palette";

/** Detects X's theme (light / dim / dark) from the computed body background. */
export function detectTheme(doc: Document = document): PageTheme {
  const bg = doc.defaultView?.getComputedStyle(doc.body).backgroundColor ?? "";
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(bg);
  if (!m) return "light";
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (r === 255 && g === 255 && b === 255) return "light";
  if (r === 21 && g === 32 && b === 43) return "dim";
  if (r === 0 && g === 0 && b === 0) return "dark";
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5 ? "light" : "dark";
}

/** Calls `cb` when the theme changes (X rewrites body's `style` attribute when switching). */
export function watchTheme(cb: (t: PageTheme) => void, doc: Document = document): () => void {
  let current = detectTheme(doc);
  const check = () => {
    const next = detectTheme(doc);
    if (next !== current) { current = next; cb(next); }
  };
  const mo = new MutationObserver(check);
  mo.observe(doc.body, { attributes: true, attributeFilter: ["style", "class"] });
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
  return () => mo.disconnect();
}
