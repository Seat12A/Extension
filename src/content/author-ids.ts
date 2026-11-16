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
import { profileHandleOf } from "./page";

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

/** Learn from the document: profile header (handle from URL) and every user cell / hover card. */
export function learnAuthorIds(root: ParentNode, pathname: string): void {
  try {
    for (const cell of Array.from(root.querySelectorAll(`${SEL.userCell}, ${SEL.hoverCard}`))) {
      const btn = cell.querySelector(SEL.followButton);
      const id = btn ? followButtonId(btn) : null;
      const handle = id ? handleOfCell(cell) : null;
      if (id && handle && /^[A-Za-z0-9_]{1,15}$/.test(handle)) remember(handle, id);
    }
    const urlHandle = profileHandleOf(pathname);
    if (!urlHandle) return;
    const header = root.querySelector(SEL.profileHeaderName);
    if (!header || !(header.textContent ?? "").toLowerCase().includes(`@${urlHandle.toLowerCase()}`)) return;
    for (const btn of Array.from(root.querySelectorAll(SEL.followButton))) {
      if (btn.closest(`${SEL.userCell}, ${SEL.hoverCard}, ${SEL.article}`)) continue;
      const id = followButtonId(btn);
      if (id) { remember(urlHandle, id); break; }
    }
  } catch { /* never throw into the page */ }
}
