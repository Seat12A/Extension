/**
 * The content-script pipeline: watches the DOM, parses posts, applies the
 * filters and talks to the service worker (the ONLY network path).
 *
 * Privacy rules enforced here:
 *  - only posts that pass the filters are sent (observations) or looked up (verdicts);
 *  - nothing about the user is sent: the logged-in handle is used locally to skip own posts;
 *  - only what is displayed is read: no scrolling, no page loads, no X APIs.
 */
import type { BadgeAccount, IngestConfig, ObservationItem, PublicVerdict } from "~/shared/api-types";
import { LIMITS } from "~/shared/constants";
import { send } from "~/shared/messages";
import type { Settings } from "~/shared/settings";
import { getAuthorId, learnAuthorIds, onAuthorIdLearned } from "./author-ids";
import { passesFilters } from "./filter";
import { pageKind } from "./page";
import { greyCheck, parsePost, type ParsedPost } from "./parser";
import { BADGE_MARK, NAME_CONTAINERS, SEL, findNameSpot, followButtonId, readOwnHandle } from "./selectors";
import { createBadge } from "./ui/badge";
import { ui } from "./ui/state";
import { createVerdict } from "./ui/verdict";

const OBSERVE_FLUSH_MS = 2000;
const OBSERVE_FLUSH_MAX = 20;
const HINTS_FLUSH_MS = 5000;
const VERDICT_BATCH_MS = 300;
const VERDICT_MAX_IDS = 50;
const CONFIG_REFRESH_MS = 5 * 60 * 1000;
const OWN_HANDLE_GRACE_MS = 3000;
const MAX_ATTEMPTS = 5;

interface PostState { post: ParsedPost; authorId?: string; passed: boolean }

export interface Pipeline {
  start(): Promise<void>;
  stop(): void;
  /** Settings changed: drop every widget and re-evaluate what is on screen. */
  applySettings(s: Settings): void;
}

function hasBadge(container: Element): boolean {
  return container.hasAttribute(BADGE_MARK) && !!container.querySelector("seat12a-badge");
}

export function createPipeline(initial: Settings): Pipeline {
  let settings = initial;
  let config: IngestConfig | null = null;
  let running = false;
  let startedAt = 0;
  let observer: MutationObserver | null = null;
  let configTimer: ReturnType<typeof setInterval> | undefined;
  let unlearn: (() => void) | undefined;

  let states = new WeakMap<Element, PostState>();
  const attempts = new WeakMap<Element, number>();
  let ownHandle: string | null = null;
  let lastHref = "";

  // ---- scheduling ------------------------------------------------------------
  const pendingNodes = new Set<Node>();
  let batchHandle: { kind: "idle" | "timeout"; id: number } | null = null;
  let fullScan = false;

  function scheduleBatch(): void {
    if (batchHandle || !running) return;
    const run = () => { batchHandle = null; runBatch(); };
    if (typeof requestIdleCallback === "function") batchHandle = { kind: "idle", id: requestIdleCallback(run, { timeout: 500 }) };
    else batchHandle = { kind: "timeout", id: window.setTimeout(run, 200) };
  }
  function scheduleLater(): void {
    if (batchHandle || !running) return;
    batchHandle = { kind: "timeout", id: window.setTimeout(() => { batchHandle = null; runBatch(); }, 500) };
  }
  function cancelBatch(): void {
    if (!batchHandle) return;
    if (batchHandle.kind === "idle" && typeof cancelIdleCallback === "function") cancelIdleCallback(batchHandle.id);
    else clearTimeout(batchHandle.id);
    batchHandle = null;
  }

  // ---- observation buffer ----------------------------------------------------
  const sentIds = new Set<string>();
  let obsBuffer: ObservationItem[] = [];
  let obsTimer: ReturnType<typeof setTimeout> | undefined;

  function flushObservations(): void {
    if (obsTimer) { clearTimeout(obsTimer); obsTimer = undefined; }
    const items = obsBuffer;
    obsBuffer = [];
    for (let i = 0; i < items.length; i += LIMITS.ingestMaxItems) {
      void send({ type: "observe", items: items.slice(i, i + LIMITS.ingestMaxItems) }).catch(() => {});
    }
  }
  function queueObservation(item: ObservationItem): void {
    obsBuffer.push(item);
    if (obsBuffer.length >= OBSERVE_FLUSH_MAX) flushObservations();
    else if (!obsTimer) obsTimer = setTimeout(flushObservations, OBSERVE_FLUSH_MS);
  }

  function toItem(p: ParsedPost, authorId: string | undefined, version: string): ObservationItem {
    const item: ObservationItem = {
      platform: "x",
      external_id: p.externalId,
      url: `https://x.com/${p.handle}/status/${p.externalId}`,
      author: authorId ? { handle: p.handle, external_id: authorId } : { handle: p.handle },
      text: p.text.slice(0, LIMITS.itemMaxTextChars),
      observed_at: new Date().toISOString(),
      filter_version: version,
    };
    if (p.langHint) item.lang_hint = p.langHint;
    if (p.createdAt) item.created_at = p.createdAt;
    if (p.metrics) item.metrics = p.metrics;
    if (p.quotedExternalId) item.quoted_external_id = p.quotedExternalId;
    if (p.parentExternalId) item.parent_external_id = p.parentExternalId;
    if (p.media.length) item.media = p.media;
    return item;
  }

  // ---- government hints ------------------------------------------------------
  const hinted = new Set<string>();
  let hintBuffer: string[] = [];
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  function flushHints(): void {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = undefined; }
    const ids = hintBuffer;
    hintBuffer = [];
    for (let i = 0; i < ids.length; i += LIMITS.govHintsMaxIds) {
      void send({ type: "governmentHints", ids: ids.slice(i, i + LIMITS.govHintsMaxIds) }).catch(() => {});
    }
  }
  /** A grey check is only a HINT sent to the server; it never produces a badge by itself. */
  function queueHint(p: ParsedPost, authorId: string): void {
    if (!p.authorHasVerifiedIcon || !greyCheck(p.verifiedColor) || hinted.has(authorId)) return;
    hinted.add(authorId);
    hintBuffer.push(authorId);
    if (!hintTimer) hintTimer = setTimeout(flushHints, HINTS_FLUSH_MS);
  }

  // ---- badges ----------------------------------------------------------------
  const badgeMemo = new Map<string, BadgeAccount | null>();
  const badgeRequested = new Set<string>();
  const badgeAwaiting = new Map<string, Set<Element>>();
  const byHandle = new Map<string, Set<Element>>(); // lower-case handle → containers waiting for an id
  let badgeQueue: string[] = [];
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;

  function renderBadge(container: Element, id: string, account: BadgeAccount): void {
    if (!container.isConnected || hasBadge(container)) return;
    const spot = findNameSpot(container);
    if (!spot) return;
    spot.after.after(createBadge(account, id));
    container.setAttribute(BADGE_MARK, id);
  }

  function requestBadge(container: Element, id: string): void {
    if (!settings.showBadges || hasBadge(container)) return;
    if (badgeMemo.has(id)) {
      const account = badgeMemo.get(id);
      if (account) renderBadge(container, id, account);
      return;
    }
    let set = badgeAwaiting.get(id);
    if (!set) badgeAwaiting.set(id, (set = new Set()));
    set.add(container);
    if (badgeRequested.has(id)) return;
    badgeRequested.add(id);
    badgeQueue.push(id);
    if (!badgeTimer) badgeTimer = setTimeout(flushBadges, LIMITS.badgeBatchDelayMs);
  }

  function flushBadges(): void {
    badgeTimer = undefined;
    const ids = badgeQueue;
    badgeQueue = [];
    for (let i = 0; i < ids.length; i += LIMITS.badgeLookupMaxIds) {
      const chunk = ids.slice(i, i + LIMITS.badgeLookupMaxIds);
      void send({ type: "lookupBadges", ids: chunk })
        .then((res) => {
          for (const id of chunk) {
            const account = res?.[id] ?? null;
            badgeMemo.set(id, account);
            const waiting = badgeAwaiting.get(id);
            badgeAwaiting.delete(id);
            if (account && waiting && settings.showBadges) for (const c of waiting) renderBadge(c, id, account);
          }
        })
        .catch(() => { for (const id of chunk) badgeRequested.delete(id); });
    }
  }

  /** Queue a badge for `container`, now if the id is known, else when the id is learned. */
  function badgeForContainer(container: Element, handle: string | null, id: string | undefined): void {
    if (!settings.showBadges) return;
    if (id) { requestBadge(container, id); return; }
    if (!handle) return;
    const key = handle.toLowerCase();
    if (byHandle.size > 2000) byHandle.clear();
    let set = byHandle.get(key);
    if (!set) byHandle.set(key, (set = new Set()));
    set.add(container);
  }

  function handleOfContainer(container: Element): string | null {
    const own = /@([A-Za-z0-9_]{1,15})/.exec(container.textContent ?? "");
    if (own) return own[1]!;
    for (const a of Array.from(container.querySelectorAll('a[href^="/"]'))) {
      const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(a.getAttribute("href") ?? "");
      if (m) return m[1]!;
    }
    return null;
  }

  /** Badges on profile headers and user cells (post names are handled with their article). */
  function decorateNameContainers(root: ParentNode): void {
    if (!settings.showBadges) return;
    const list: Element[] = [];
    if (root instanceof Element && root.matches(NAME_CONTAINERS)) list.push(root);
    list.push(...Array.from(root.querySelectorAll(NAME_CONTAINERS)));
    for (const c of list) {
      if (c.matches(SEL.userName) || hasBadge(c)) continue;
      const btn = c.matches(SEL.userCell) ? c.querySelector(SEL.followButton) : null;
      const handle = handleOfContainer(c);
      const id = (btn ? followButtonId(btn) : null) ?? (handle ? getAuthorId(handle) : undefined);
      badgeForContainer(c, handle, id ?? undefined);
    }
  }

  function onIdLearned(handle: string, id: string): void {
    const key = handle.toLowerCase();
    const set = byHandle.get(key);
    if (!set) return;
    byHandle.delete(key);
    for (const c of set) if (c.isConnected) requestBadge(c, id);
  }

  // ---- verdicts --------------------------------------------------------------
  const verdictMemo = new Map<string, PublicVerdict | null>();
  const verdictRequested = new Set<string>();
  const verdictAwaiting = new Map<string, Set<Element>>();
  let verdictQueue: string[] = [];
  let verdictTimer: ReturnType<typeof setTimeout> | undefined;

  function renderVerdict(article: Element, verdict: PublicVerdict): void {
    if (!article.isConnected || article.querySelector("seat12a-verdict")) return;
    const post = states.get(article)?.post;
    if (!post || !post.nodes.actionGroup) return;
    const { actionGroup, textEl, userName } = post.nodes;
    // Insert as a sibling of the content column's children, just before the action bar.
    const ref = textEl ?? userName;
    let anchor: Element = actionGroup;
    while (anchor.parentElement && anchor.parentElement !== article && !anchor.parentElement.contains(ref)) anchor = anchor.parentElement;
    anchor.before(createVerdict(verdict));
  }

  function requestVerdict(article: Element, id: string): void {
    if (!settings.showVerdicts) return;
    if (verdictMemo.has(id)) {
      const v = verdictMemo.get(id);
      if (v) renderVerdict(article, v);
      return;
    }
    let set = verdictAwaiting.get(id);
    if (!set) verdictAwaiting.set(id, (set = new Set()));
    set.add(article);
    if (verdictRequested.has(id)) return;
    verdictRequested.add(id);
    verdictQueue.push(id);
    if (!verdictTimer) verdictTimer = setTimeout(flushVerdicts, VERDICT_BATCH_MS);
  }

  function flushVerdicts(): void {
    verdictTimer = undefined;
    const ids = verdictQueue;
    verdictQueue = [];
    for (let i = 0; i < ids.length; i += VERDICT_MAX_IDS) {
      const chunk = ids.slice(i, i + VERDICT_MAX_IDS);
      void send({ type: "getVerdicts", ids: chunk, lang: ui.t.lang })
        .then((res) => {
          for (const id of chunk) {
            const v = res?.[id] ?? null;
            verdictMemo.set(id, v);
            const waiting = verdictAwaiting.get(id);
            verdictAwaiting.delete(id);
            if (v && waiting && settings.showVerdicts) for (const a of waiting) renderVerdict(a, v);
          }
        })
        .catch(() => { /* at most once per post per page session */ });
    }
  }

  // ---- posts -----------------------------------------------------------------
  /** X re-renders subtrees: put back widgets that vanished. */
  function ensureWidgets(article: Element, state: PostState): void {
    if (settings.showBadges) badgeForContainer(state.post.nodes.userName, state.post.handle, state.authorId ?? getAuthorId(state.post.handle));
    if (state.passed && settings.showVerdicts) {
      const v = verdictMemo.get(state.post.externalId);
      if (v) renderVerdict(article, v);
    }
  }

  function processArticle(article: Element): void {
    const known = states.get(article);
    if (known) { ensureWidgets(article, known); return; }
    if ((attempts.get(article) ?? 0) >= MAX_ATTEMPTS) return;
    const post = parsePost(article, location, ownHandle);
    if (!post) { attempts.set(article, (attempts.get(article) ?? 0) + 1); return; }

    const authorId = getAuthorId(post.handle);
    const passed = passesFilters(post, config, authorId);
    states.set(article, { post, authorId, passed });

    if (settings.showBadges) {
      badgeForContainer(post.nodes.userName, post.handle, authorId);
      if (authorId) queueHint(post, authorId);
    }
    if (!passed || !config || config.version == null) return;
    if (settings.sendObservations && !sentIds.has(post.externalId)) {
      sentIds.add(post.externalId);
      queueObservation(toItem(post, authorId, config.version));
    }
    requestVerdict(article, post.externalId);
  }

  function collectArticles(node: Node, into: Set<Element>): void {
    if (!(node instanceof Element)) return;
    const own = node.closest(SEL.article);
    if (own) into.add(own);
    for (const a of Array.from(node.querySelectorAll(SEL.article))) into.add(a);
  }

  function runBatch(): void {
    try {
      const href = location.href;
      if (href !== lastHref) { lastHref = href; fullScan = true; }
      ownHandle = ownHandle ?? readOwnHandle();
      if (!ownHandle && Date.now() - startedAt < OWN_HANDLE_GRACE_MS) {
        // Navigation not rendered yet: wait so we never process the user's own posts.
        scheduleLater();
        return;
      }
      const kind = pageKind(location.pathname, ownHandle);
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();
      const scan = fullScan;
      fullScan = false;
      if (!kind || (!nodes.length && !scan)) return;

      learnAuthorIds(document, location.pathname);
      const articles = new Set<Element>();
      if (scan) for (const a of Array.from(document.querySelectorAll(SEL.article))) articles.add(a);
      for (const n of nodes) collectArticles(n, articles);
      for (const a of articles) processArticle(a);

      if (settings.showBadges) {
        if (scan) decorateNameContainers(document);
        else for (const n of nodes) if (n instanceof Element) decorateNameContainers(n.closest(NAME_CONTAINERS) ?? n);
      }
    } catch { /* never throw into the page */ }
  }

  function onMutations(records: MutationRecord[]): void {
    for (const r of records) for (const n of Array.from(r.addedNodes)) if (n.nodeType === Node.ELEMENT_NODE) pendingNodes.add(n);
    scheduleBatch(); // URL changes are detected inside the batch
  }
  function onPop(): void { fullScan = true; scheduleBatch(); }

  async function refreshConfig(): Promise<void> {
    try {
      const next = (await send({ type: "getConfig" })) ?? null;
      const changed = JSON.stringify(next) !== JSON.stringify(config);
      config = next;
      if (changed && running) { states = new WeakMap(); fullScan = true; scheduleBatch(); }
    } catch { /* keep the previous config */ }
  }

  function removeWidgets(): void {
    for (const el of Array.from(document.querySelectorAll("seat12a-badge, seat12a-verdict"))) el.remove();
    for (const el of Array.from(document.querySelectorAll(`[${BADGE_MARK}]`))) el.removeAttribute(BADGE_MARK);
  }

  return {
    async start() {
      if (running) return;
      running = true;
      startedAt = Date.now();
      await refreshConfig();
      if (!running) return;
      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("popstate", onPop);
      unlearn = onAuthorIdLearned(onIdLearned);
      configTimer = setInterval(() => void refreshConfig(), CONFIG_REFRESH_MS);
      fullScan = true;
      scheduleBatch();
    },
    stop() {
      running = false;
      observer?.disconnect();
      observer = null;
      window.removeEventListener("popstate", onPop);
      unlearn?.();
      if (configTimer) clearInterval(configTimer);
      cancelBatch();
      flushObservations();
      flushHints();
      for (const t of [verdictTimer, badgeTimer]) if (t) clearTimeout(t);
      verdictTimer = badgeTimer = undefined;
    },
    applySettings(s) {
      settings = s;
      removeWidgets();
      states = new WeakMap();
      verdictMemo.clear();
      verdictRequested.clear();
      verdictAwaiting.clear();
      badgeAwaiting.clear();
      byHandle.clear();
      fullScan = true;
      scheduleBatch();
    },
  };
}
