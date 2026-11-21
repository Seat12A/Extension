/**
 * Types of the Tower gate API as used by the extension (contract documented in
 * docs/tower-contract.md). Every identifier is a string. Unknown enum values may be
 * added server-side later: UI code must handle them with a generic label.
 */

export type Platform = "x";

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown>; request_id?: string; fingerprint?: string };
}

// ---- Ingestion ----------------------------------------------------------------
export interface IngestAccountFilter { platform: Platform; external_id: string }
export interface IngestFilters {
  keywords: string[];
  accounts: IngestAccountFilter[];
  thresholds: Record<string, number>;
}
export interface IngestConfig { version: string | null; filters: IngestFilters }

export type MediaKind = "image" | "video" | "audio" | "document";
export interface ObservationMetrics { views?: number; likes?: number; reposts?: number; replies?: number; quotes?: number; bookmarks?: number }
/**
 * One observed post, as queued inside the extension. `filter_version` is internal: on the
 * wire it moves to the batch (`IngestRequest.filter_version`), since Tower refuses unknown
 * item fields (422 TWR-GEN-001).
 */
export interface ObservationItem {
  platform: Platform;
  external_id: string;
  author: { handle: string; external_id?: string; display_name?: string };
  text: string;
  lang_hint?: string;
  created_at?: string; // ISO 8601
  observed_at: string; // ISO 8601
  metrics?: ObservationMetrics;
  quoted_external_id?: string;
  parent_external_id?: string;
  media?: { kind: MediaKind; url: string }[];
  filter_version: string;
}
/** Item exactly as accepted by `POST /v1/ingest/observations`. */
export type IngestItem = Omit<ObservationItem, "filter_version">;
export interface IngestRequest { filter_version: string | null; items: IngestItem[] }
export interface IngestResponse {
  accepted: number;
  new: number;
  duplicates: number;
  rejected: number;
  errors: { index: number; code: string }[];
}

// ---- Verdicts -----------------------------------------------------------------
export type Veracity = "true" | "mostly_true" | "misleading" | "false" | "unverifiable" | (string & {});
export type ContextNeed = "none" | "useful" | "necessary" | (string & {});
export interface VerdictNote {
  lang: string;
  text: string;
  fact_sheet?: string | null;
  machine_translated: boolean;
  links: string[];
}
export interface VerdictInherited { origin_url?: string | null; [k: string]: unknown }
export interface VerdictClaim {
  text: string;
  lang: string;
  veracity: Veracity;
  context_need: ContextNeed;
  context_types: string[];
  validated_at: string;
  note: VerdictNote | null;
  inherited: VerdictInherited | null;
}
export interface PublicVerdict {
  platform: Platform;
  external_id: string;
  url: string | null;
  lang: string;
  claims: VerdictClaim[];
}

// ---- Badges -------------------------------------------------------------------
/** `personality` was renamed `verified` by Tower (2026-11-21); the client maps the old value. */
export type BadgeCategory = "institutional" | "media" | "expert" | "organization" | "verified" | (string & {});
export interface BadgeCategoryInfo { category: BadgeCategory; color: string; rank: number }
export interface BadgeOwn {
  category: BadgeCategory;
  color: string;
  label?: string | null;
  /** Field of an `expert` badge, free French text (≤ 120), else null. Plain text only. */
  expertise?: string | null;
}
export interface BadgeOrg {
  platform?: Platform;
  external_id?: string;
  label: string;
  logo_url?: string | null;
  /** The ORGANISATION's own badge: for details only, never the colour of an affiliate's check. */
  category?: BadgeCategory | null;
  color?: string | null;
}
export interface BadgeAffiliation { org: BadgeOrg; title?: string | null }
/**
 * One account of `GET /v1/badges/lookup`. Badge and affiliation are INDEPENDENT:
 *  - the check comes only from the account's own `badge` (`category`/`color` mirror it, null otherwise);
 *  - an affiliation shows the organisation's logo next to the name, never a check.
 */
export interface BadgeAccount {
  category: BadgeCategory | null;
  color: string | null;
  badge: BadgeOwn | null;
  /** Main affiliation (chosen by the Seat 12A team): its logo goes next to the name. */
  affiliation: BadgeAffiliation | null;
  /** Every active affiliation, main one first, ≤ 5. */
  affiliations: BadgeAffiliation[];
}
export interface BadgeLookupResponse { accounts: Record<string, BadgeAccount> }
export interface BadgeAccountDetail extends BadgeAccount {
  platform: Platform;
  external_id: string;
}

export type BadgeReportReason = "wrong_category" | "not_eligible" | "impersonation" | "wrong_affiliation" | "other";
export interface AccountRef { platform: Platform; external_id: string }
export interface BadgeRequestBody {
  kind: "badge" | "affiliation";
  account: AccountRef;
  category?: BadgeCategory;
  org?: AccountRef;
  title?: string;
  justification: string;
  contact?: string;
  evidence_urls?: string[];
}
export interface BadgeReportBody { account: AccountRef; reason: BadgeReportReason; comment?: string }
