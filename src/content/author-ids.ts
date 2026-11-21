/**
 * handle → numeric X user id, learned from what is displayed.
 *
 * PARTIAL COVERAGE (open point 1): numeric author ids are not reliably in the DOM.
 * The only places X exposes them are follow buttons (`data-testid="<id>-follow"` /
 * `-unfollow`) in the profile header, user cells (who to follow, followers lists,
 * search people) and hover cards. Posts in a timeline therefore resolve to an id
 * only when the author's id was seen somewhere before. The planned solution is a
 * server-side handle → id mapping; until then posts with an unknown id are matched
 * by keywords only and get no badge.
 */
import { followButtonId, SEL } from "./selectors";

const KEY = "authorIds";
const CAP = 5000;
const DEBOUNCE_MS = 1000;

const ids = new Map<string, string>(); // lower-case handle → id
const listeners = new Set<(handle: string, id: string) => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function getAuthorId(handle: string): string | undefined {
  return ids.get(handle.toLowerCase());
}

/** Called when a new (handle, id) pair is learned. */
export function onAuthorIdLearned(cb: (handle: string, id: string) => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

function remember(handle: string, id: string): void {
  const key = handle.toLowerCase();
  if (ids.get(key) === id) return;
  // An id has one handle at a time (handles can be renamed): forget the old one.
  for (const [h, v] of ids) if (v === id && h !== key) ids.delete(h);
  if (!ids.has(key) && ids.size >= CAP) ids.delete(ids.keys().next().value as string);
  ids.set(key, id);
  schedulePersist();
  for (const l of listeners) l(handle, id);
}

function schedulePersist(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void persistAuthorIds();
  }, DEBOUNCE_MS);
}

export async function persistAuthorIds(): Promise<void> {
  try {
    await chrome.storage.session.set({ [KEY]: Object.fromEntries(ids) });
  } catch { /* session storage unavailable: memory only */ }
}

export async function loadAuthorIds(): Promise<void> {
  try {
    const raw = (await chrome.storage.session.get(KEY))[KEY] as Record<string, string> | undefined;
    for (const [h, id] of Object.entries(raw ?? {})) if (!ids.has(h) && /^\d+$/.test(id)) ids.set(h, id);
  } catch { /* ignore */ }
}

export function resetAuthorIds(): void {
  ids.clear();
  if (timer) clearTimeout(timer);
  timer = undefined;
}

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

/** `@handle` written in a follow button's accessible name ("Follow @x", "Suivre @x"…), any language. */
function handleOfButton(btn: Element): string | null {
  const m = /@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/.exec(btn.getAttribute("aria-label") ?? "");
  return m ? m[1]! : null;
}

function handleOfCell(cell: Element): string | null {
  const links = Array.from(cell.querySelectorAll('a[href^="/"]'));
  for (const a of links) {
    if ((a.textContent ?? "").trim().startsWith("@")) return (a.textContent ?? "").trim().slice(1).split(/\s/)[0]!;
  }
  for (const a of links) {
    if (a.getAttribute("role") !== "link") continue;
    const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(a.getAttribute("href") ?? "");
    if (m) return m[1]!;
  }
  return null;
}

/**
 * Profile pages carry a schema.org `ProfilePage` JSON-LD block whose Person has the
 * handle (`additionalName`) and the numeric id (`identifier`) side by side. Both come
 * from the same object, so the pair is self-consistent even right after an SPA navigation.
 */
function learnFromJsonLd(root: ParentNode): void {
  for (const script of Array.from(root.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown;
    try { data = JSON.parse(script.textContent ?? ""); } catch { continue; }
    const stack: unknown[] = [data];
    for (let guard = 0; stack.length && guard < 200; guard++) {
      const v = stack.pop();
      if (!v || typeof v !== "object") continue;
      if (Array.isArray(v)) { stack.push(...v); continue; }
      const o = v as Record<string, unknown>;
      const handle = typeof o.additionalName === "string" ? o.additionalName.replace(/^@/, "") : "";
      const id = typeof o.identifier === "string" || typeof o.identifier === "number" ? String(o.identifier) : "";
      if (HANDLE_RE.test(handle) && /^\d{1,19}$/.test(id)) remember(handle, id);
      for (const k of ["mainEntity", "author", "about", "@graph"]) if (o[k]) stack.push(o[k]);
    }
  }
}

/**
 * Learn from the document. The (handle, id) pair must come from ONE element, never from
 * two places that X may update at different times during an SPA navigation:
 *  - a follow button whose accessible name holds the handle ("Follow @x"), wherever it is
 *    (profile header, focal post, user cell, hover card);
 *  - otherwise a follow button inside a user cell / hover card, with that cell's handle;
 *  - the profile page JSON-LD.
 */
export function learnAuthorIds(root: ParentNode, _pathname?: string): void {
  try {
    for (const btn of Array.from(root.querySelectorAll(SEL.followButton))) {
      const id = followButtonId(btn);
      if (!id) continue;
      let handle = handleOfButton(btn);
      if (!handle) {
        const cell = btn.closest(`${SEL.userCell}, ${SEL.hoverCard}`);
        handle = cell ? handleOfCell(cell) : null;
      }
      if (handle && HANDLE_RE.test(handle)) remember(handle, id);
    }
    learnFromJsonLd(root);
  } catch { /* never throw into the page */ }
}
