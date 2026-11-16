/** Which X pages the extension works on. Everything else is ignored. */
export type PageKind = "home" | "profile" | "status" | "search";

const RESERVED = new Set([
  "messages", "notifications", "settings", "compose", "i", "bookmarks", "lists", "explore",
  "communities", "jobs", "premium", "login", "logout", "signup", "tos", "privacy", "about",
  "intent", "share", "hashtag", "topics", "following", "followers", "verified-orgs-signup",
]);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const PROFILE_TABS = new Set(["with_replies", "media"]);

export function pageKind(pathname: string, ownHandle?: string | null): PageKind | null {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (!first) return null;
  const lower = first.toLowerCase();
  if (lower === "home") return parts.length === 1 ? "home" : null;
  if (lower === "search") return "search";
  if (RESERVED.has(lower) || !HANDLE.test(first)) return null;
  if (ownHandle && lower === ownHandle.toLowerCase()) return null;
  if (parts.length === 1) return "profile";
  if (parts.length === 2 && PROFILE_TABS.has(parts[1]!.toLowerCase())) return "profile";
  if (parts[1] === "status" && /^\d+$/.test(parts[2] ?? "")) return "status";
  return null;
}

/** `/<handle>/status/<id>` (extra segments allowed) → { handle, id }. */
export function parseStatusPath(path: string): { handle: string; id: string } | null {
  const m = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:[/?#]|$)/.exec(path);
  return m ? { handle: m[1]!, id: m[2]! } : null;
}

/** Handle of a profile URL path (first segment) when it looks like one. */
export function profileHandleOf(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first || RESERVED.has(first.toLowerCase()) || first.toLowerCase() === "home" || first.toLowerCase() === "search") return null;
  return HANDLE.test(first) ? first : null;
}
