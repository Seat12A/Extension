import type { MediaKind, ObservationMetrics } from "~/shared/api-types";
import { parseCompactNumber } from "./numbers";
import { parseStatusPath } from "./page";
import { SEL } from "./selectors";

export interface ParsedMedia { kind: MediaKind; url: string }

/** DOM references needed for rendering. Never serialised nor sent. */
export interface PostNodes {
  article: Element;
  userName: Element;
  textEl: Element | null;
  actionGroup: Element | null;
}

export interface ParsedPost {
  externalId: string;
  handle: string;
  text: string;
  langHint?: string;
  createdAt?: string;
  metrics?: ObservationMetrics;
  quotedExternalId?: string;
  parentExternalId?: string;
  media: ParsedMedia[];
  authorHasVerifiedIcon: boolean;
  verifiedColor: string | null;
  nodes: PostNodes;
}

const NO_LANG = new Set(["und", "qme", "qht", "zxx", "art"]);
const STATUS_RE = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/;

function statusOfHref(href: string | null): { handle: string; id: string } | null {
  if (!href) return null;
  let path = href;
  try { path = new URL(href, "https://x.com").pathname; } catch { return null; }
  const m = STATUS_RE.exec(path);
  return m ? { handle: m[1]!, id: m[2]! } : null;
}

/** Status id / handle of an article's main post (the link wrapping the first `time` of its first User-Name). */
export function mainStatus(article: Element): { handle: string; id: string; userName: Element; time: Element } | null {
  const userName = article.querySelector(SEL.userName);
  const time = userName?.querySelector(SEL.time);
  const a = time?.closest("a");
  if (!userName || !time || !a) return null;
  const s = statusOfHref(a.getAttribute("href"));
  return s ? { ...s, userName, time } : null;
}

/** Container of the quoted post inside `article`, if any (second User-Name). */
function quoteContainer(article: Element, mainName: Element): Element | null {
  const names = Array.from(article.querySelectorAll(SEL.userName));
  const qName = names.find((n) => n !== mainName && !mainName.contains(n) && !n.contains(mainName));
  if (!qName) return null;
  const byRole = qName.parentElement?.closest(SEL.roleLink);
  if (byRole && byRole !== article && article.contains(byRole) && !byRole.contains(mainName)) return byRole;
  let el: Element = qName;
  while (el.parentElement && el.parentElement !== article && !el.parentElement.contains(mainName)) el = el.parentElement;
  return el;
}

/** Text of a tweetText element: text nodes + emoji alt + <br>, skipping aria-hidden. */
export function extractText(root: Element): string {
  let out = "";
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) out += child.nodeValue ?? "";
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (el.getAttribute("aria-hidden") === "true") continue;
        const tag = el.localName;
        if (tag === "br") out += "\n";
        else if (tag === "img") out += el.getAttribute("alt") ?? "";
        else walk(el);
      }
    }
  };
  walk(root);
  return out.trim();
}

function metricOf(scope: Element, selector: string): number | undefined {
  const btn = scope.querySelector(selector);
  const txt = btn?.querySelector(SEL.metricText)?.textContent;
  return parseCompactNumber(txt);
}

/** True for X's "government" grey check colour (e.g. rgb(130, 154, 171)): neutral-ish but not black/white. */
export function greyCheck(color: string | null): boolean {
  if (!color) return false;
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(color);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (Math.abs(r - g) >= 40 || Math.abs(g - b) >= 40 || Math.abs(r - b) >= 50) return false;
  const avg = (r + g + b) / 3;
  return avg > 60 && avg < 200;
}

function iconColor(icon: Element): string | null {
  const view = icon.ownerDocument.defaultView;
  if (!view) return null;
  const cs = view.getComputedStyle(icon);
  for (const v of [cs.color, cs.fill]) if (v && /^rgb/.test(v)) return v;
  return null;
}

/**
 * Parse one rendered post. Pure: reads only what is displayed. Returns null for
 * anything not safely recognisable, ads, protected accounts and the user's own posts.
 */
export function parsePost(article: Element, loc: { pathname: string }, ownHandle?: string | null): ParsedPost | null {
  try {
    if (article.closest(SEL.ad) || article.querySelector(SEL.ad)) return null;
    const main = mainStatus(article);
    if (!main) return null;
    const { handle, id, userName, time } = main;
    if (ownHandle && handle.toLowerCase() === ownHandle.toLowerCase()) return null;
    if (userName.querySelector(SEL.lock)) return null;

    const quote = quoteContainer(article, userName);
    const outside = (el: Element) => !quote || !quote.contains(el);

    let quotedExternalId: string | undefined;
    if (quote) {
      for (const a of Array.from(quote.querySelectorAll("a[href]"))) {
        const s = statusOfHref(a.getAttribute("href"));
        if (s) { quotedExternalId = s.id; break; }
      }
    }

    const textEl = Array.from(article.querySelectorAll(SEL.tweetText)).find(outside) ?? null;
    const text = textEl ? extractText(textEl) : "";
    const lang = textEl?.getAttribute("lang") ?? "";
    const langHint = lang && !NO_LANG.has(lang.toLowerCase()) ? lang : undefined;

    const media: ParsedMedia[] = [];
    for (const img of Array.from(article.querySelectorAll(SEL.photo))) {
      const src = img.getAttribute("src") ?? "";
      if (outside(img) && src.startsWith("https://")) media.push({ kind: "image", url: src });
    }
    for (const v of Array.from(article.querySelectorAll(SEL.video))) {
      const poster = v.getAttribute("poster") ?? "";
      if (outside(v) && poster.startsWith("https://")) media.push({ kind: "video", url: poster });
    }
    const hasMedia = Array.from(article.querySelectorAll(`${SEL.photo}, ${SEL.video}`)).some(outside);
    if (!text && !hasMedia) return null;

    const actionGroup =
      Array.from(article.querySelectorAll(SEL.reply)).filter(outside).map((r) => r.closest(SEL.actionGroup)).find(Boolean) ?? null;
    const scope = actionGroup ?? article;
    const metrics: ObservationMetrics = {};
    const replies = metricOf(scope, SEL.reply);
    const reposts = metricOf(scope, SEL.retweet);
    const likes = metricOf(scope, SEL.like);
    const viewsLink = Array.from(article.querySelectorAll(SEL.views)).find(outside);
    const views = parseCompactNumber(viewsLink?.querySelector(SEL.metricText)?.textContent ?? viewsLink?.textContent);
    if (replies !== undefined) metrics.replies = replies;
    if (reposts !== undefined) metrics.reposts = reposts;
    if (likes !== undefined) metrics.likes = likes;
    if (views !== undefined) metrics.views = views;

    let parentExternalId: string | undefined;
    const urlStatus = parseStatusPath(loc.pathname);
    if (urlStatus && urlStatus.id === id) {
      const all = Array.from(article.ownerDocument.querySelectorAll(SEL.article));
      const prev = all[all.indexOf(article) - 1];
      const prevId = prev ? mainStatus(prev)?.id : undefined;
      if (prevId) parentExternalId = prevId;
    }

    const icon = userName.querySelector(SEL.verified);
    const post: ParsedPost = {
      externalId: id,
      handle,
      text,
      media: media.slice(0, 4),
      authorHasVerifiedIcon: !!icon,
      verifiedColor: icon ? iconColor(icon) : null,
      nodes: { article, userName, textEl, actionGroup },
    };
    if (langHint) post.langHint = langHint;
    const created = time.getAttribute("datetime");
    if (created) post.createdAt = created;
    if (Object.keys(metrics).length) post.metrics = metrics;
    if (quotedExternalId) post.quotedExternalId = quotedExternalId;
    if (parentExternalId) post.parentExternalId = parentExternalId;
    return post;
  } catch {
    return null;
  }
}
