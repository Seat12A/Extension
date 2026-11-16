/**
 * EVERY X-specific selector lives here (and nowhere else). When X changes its DOM,
 * this is the only file to touch. Parsing fails silently: if something is not
 * recognised the post is ignored, never sent half-parsed.
 */
export const SEL = {
  article: 'article[data-testid="tweet"]',
  userName: '[data-testid="User-Name"]',
  tweetText: '[data-testid="tweetText"]',
  time: "time[datetime]",
  photo: '[data-testid="tweetPhoto"] img',
  video: '[data-testid="videoPlayer"] video',
  reply: '[data-testid="reply"]',
  retweet: '[data-testid="retweet"], [data-testid="unretweet"]',
  like: '[data-testid="like"], [data-testid="unlike"]',
  views: 'a[href$="/analytics"]',
  metricText: '[data-testid="app-text-transition-container"]',
  actionGroup: '[role="group"]',
  verified: '[data-testid="icon-verified"]',
  lock: '[data-testid="icon-lock"]',
  ad: '[data-testid="placementTracking"]',
  socialContext: '[data-testid="socialContext"]',
  profileLink: 'a[data-testid="AppTabBar_Profile_Link"]',
  profileHeaderName: '[data-testid="UserName"]',
  userCell: '[data-testid="UserCell"]',
  hoverCard: '[data-testid="HoverCard"]',
  followButton: '[data-testid$="-follow"], [data-testid$="-unfollow"]',
  primaryColumn: '[data-testid="primaryColumn"]',
  roleLink: '[role="link"]',
  statusLink: 'a[href*="/status/"]',
} as const;

/** Every name container we decorate with a badge. */
export const NAME_CONTAINERS = `${SEL.userName}, ${SEL.profileHeaderName}, ${SEL.userCell}`;

export const BADGE_MARK = "data-seat12a-badge";

/** Handle of the logged-in user, read from the left navigation (used ONLY locally). */
export function readOwnHandle(doc: Document = document): string | null {
  const href = doc.querySelector(SEL.profileLink)?.getAttribute("href");
  const m = href ? /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(href) : null;
  return m ? m[1]! : null;
}

/** Numeric user id from a follow button test id (`123456-follow`). */
export function followButtonId(el: Element): string | null {
  const m = /^(\d+)-(?:follow|unfollow)$/.exec(el.getAttribute("data-testid") ?? "");
  return m ? m[1]! : null;
}

/** First non-empty visible text node under `root` (skips svg and aria-hidden). */
function firstTextNode(root: Element): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as Element;
        return e.localName === "svg" || e.getAttribute("aria-hidden") === "true" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return (n.nodeValue ?? "").trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  return walker.nextNode() as Text | null;
}

/** `after`: node to insert the badge after; `name`: the name element (font reference). */
export interface NameSpot { parent: Element; after: Element; name: Element }

/**
 * Where to put the badge in a name container: on the SAME ROW as the display name,
 * exactly where X puts its own checkmark.
 *
 * X's name markup is `a > div[dir] (flex row) > span > span "Name"` and the check is a
 * sibling `span > svg[data-testid=icon-verified]` inside that `div[dir]`. Every X block
 * (`css-175oi2r`) is a COLUMN flex container, so inserting after the `div[dir]` (or
 * anywhere outside the row) wraps the badge onto its own line. Rules:
 *   1. if X's check is present, insert right after its wrapper (the check is hidden
 *      by CSS, the badge takes its exact slot);
 *   2. otherwise insert right after the outermost inline `<span>` holding the name,
 *      i.e. still inside the row.
 * `container` is a `User-Name`, a profile header `UserName` or a `UserCell`.
 */
export function findNameSpot(container: Element): NameSpot | null {
  const anchors = Array.from(container.querySelectorAll('a[role="link"]'));
  const anchor =
    anchors.find((a) => {
      const txt = (a.textContent ?? "").trim();
      return txt && !txt.startsWith("@") && !/\/status\//.test(a.getAttribute("href") ?? "");
    }) ?? container;
  const textNode = firstTextNode(anchor);
  const textEl = textNode?.parentElement;
  if (!textEl) return null;
  // Outermost inline span of the name, staying inside its row.
  let nameSpan: Element = textEl;
  while (nameSpan.parentElement && nameSpan.parentElement !== anchor && nameSpan.parentElement.localName === "span") {
    nameSpan = nameSpan.parentElement;
  }
  const row = nameSpan.parentElement;
  if (!row) return null;
  // 1. X's own check, in the same row (or the next sibling row X sometimes uses).
  const check = row.querySelector(SEL.verified);
  if (check) {
    let wrap: Element = check;
    while (wrap.parentElement && wrap.parentElement !== row) wrap = wrap.parentElement;
    if (wrap.parentElement === row) return { parent: row, after: wrap, name: nameSpan };
  }
  // 2. Right after the name.
  return { parent: row, after: nameSpan, name: nameSpan };
}
