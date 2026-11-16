/** Tiny DOM helpers. Server data only ever goes through textContent / text nodes / setAttribute. */
const SVG_NS = "http://www.w3.org/2000/svg";

export type AttrValue = string | number | boolean | null | undefined | ((e: Event) => void);
export type Attrs = Record<string, AttrValue>;
export type Child = Node | string | null | undefined | false;

function apply(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, "").toLowerCase(), v);
    else if (k === "class") el.setAttribute("class", String(v));
    else el.setAttribute(k, v === true ? "" : String(v));
  }
}

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

export function s(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  append(el, children);
  return el as SVGElement;
}

/** Parses one of OUR static SVG strings (never server data). */
export function parseSvg(markup: string): SVGSVGElement | null {
  try {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.localName !== "svg") return null;
    return document.importNode(root, true) as unknown as SVGSVGElement;
  } catch {
    return null;
  }
}

/** Returns the URL if it is a well-formed https URL, else null. */
export function safeHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Stops X from reacting (opening the post, navigating) to clicks inside our widgets. */
export function isolateEvents(el: Element): void {
  for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "dblclick", "auxclick"]) {
    el.addEventListener(type, (e) => e.stopPropagation());
  }
}

const sheets = new Map<string, CSSStyleSheet>();
/** Gives a shadow root its stylesheet (constructable stylesheet when available, else <style>). */
export function applyStyles(root: ShadowRoot, css: string): void {
  try {
    let sheet = sheets.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      sheets.set(css, sheet);
    }
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = css;
    root.prepend(style);
  }
}

/** Creates a widget host with an open shadow root. Works whether or not customElements is available. */
export function createHost(tag: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement(tag);
  const root = host.attachShadow({ mode: "open" });
  return { host, root };
}
