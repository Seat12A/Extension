/**
 * Runtime message protocol. Content script, popup and options never touch the
 * network: they send one of these messages to the service worker, which answers
 * with the matching response. Keep requests and responses JSON-serialisable.
 */
import type {
  BadgeAccount, BadgeAccountDetail, BadgeCategoryInfo, BadgeReportBody, BadgeRequestBody,
  IngestConfig, ObservationItem, PublicVerdict,
} from "./api-types";

export type ExtensionState =
  | "active"      // sending observations normally
  | "paused"      // user turned sending off
  | "quota"       // TWR-ING-002, suspended until next 00:00 UTC
  | "offline"     // gate unreachable / backing off
  | "no_filters"; // no active filter version: nothing is sent

export interface ExtensionStatus {
  state: ExtensionState;
  queueSize: number;
  sentToday: number;
  /** ISO time when quota suspension or backoff ends, if any. */
  resumeAt: string | null;
  filterVersion: string | null;
  lastSyncAt: string | null;
}

/** Outcome of a public form submission. `code` is a TWR-… error code. */
export type SubmitResult = { ok: true } | { ok: false; code: string };

export type Request =
  | { type: "observe"; items: ObservationItem[] }
  | { type: "getConfig" }
  | { type: "getVerdicts"; ids: string[]; lang: string }
  | { type: "lookupBadges"; ids: string[] }
  | { type: "getBadgeCategories" }
  | { type: "getAccountDetail"; id: string }
  | { type: "governmentHints"; ids: string[] }
  | { type: "submitBadgeRequest"; body: BadgeRequestBody }
  | { type: "submitBadgeReport"; body: BadgeReportBody }
  | { type: "getStatus" }
  | { type: "resetToken" }
  | { type: "clearCaches" }
  | { type: "openOptions"; hash?: string };

export interface ResponseMap {
  observe: { queued: number };
  getConfig: IngestConfig | null;
  /** id → verdict, or null when the post has no validated verdict (404 TWR-FCK-013). */
  getVerdicts: Record<string, PublicVerdict | null>;
  /** id → badge, or null when the account shows no Seat 12A badge. */
  lookupBadges: Record<string, BadgeAccount | null>;
  getBadgeCategories: BadgeCategoryInfo[];
  getAccountDetail: BadgeAccountDetail | null;
  governmentHints: { queued: number };
  submitBadgeRequest: SubmitResult;
  submitBadgeReport: SubmitResult;
  getStatus: ExtensionStatus;
  resetToken: { ok: true };
  clearCaches: { ok: true };
  openOptions: { ok: true };
}

export type ResponseFor<R extends Request> = ResponseMap[R["type"]];

/** Typed wrapper around chrome.runtime.sendMessage. Rejects if the worker answers `{__error}`. */
export async function send<R extends Request>(req: R): Promise<ResponseFor<R>> {
  const res: unknown = await chrome.runtime.sendMessage(req);
  if (res && typeof res === "object" && "__error" in res) throw new Error(String((res as { __error: unknown }).__error));
  return res as ResponseFor<R>;
}
