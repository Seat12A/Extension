/** Pure validation + body building for the badge request form (unit-tested). */
import type { BadgeCategory, BadgeRequestBody } from "~/shared/api-types";

export interface RequestValues {
  kind: "badge" | "affiliation";
  accountId: string;
  category: BadgeCategory;
  orgId: string;
  orgTitle: string;
  justification: string;
  contact: string;
  evidence: string;
}

export type RequestErrors = Partial<Record<"accountId" | "orgId" | "orgTitle" | "justification" | "contact" | "evidence", string>>;

export const ID_PATTERN = /^\d{1,19}$/;
export const MAX_EVIDENCE = 10;

export function parseEvidence(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Returns translation keys per invalid field (empty object = valid). */
export function validateRequest(v: RequestValues): RequestErrors {
  const e: RequestErrors = {};
  if (!ID_PATTERN.test(v.accountId.trim())) e.accountId = "options_error_account";
  if (v.kind === "affiliation") {
    if (!ID_PATTERN.test(v.orgId.trim())) e.orgId = "options_error_org";
    const title = v.orgTitle.trim();
    if (title.length < 1 || title.length > 200) e.orgTitle = "options_error_org_title";
  }
  const j = v.justification.trim().length;
  if (j < 20 || j > 2000) e.justification = "options_error_justification";
  if (v.contact.trim().length > 200) e.contact = "options_error_contact";
  const urls = parseEvidence(v.evidence);
  if (urls.length > MAX_EVIDENCE) e.evidence = "options_error_evidence_count";
  else if (urls.some((u) => !/^https:\/\/\S+$/i.test(u))) e.evidence = "options_error_evidence_https";
  return e;
}

export function buildRequestBody(v: RequestValues): BadgeRequestBody {
  const body: BadgeRequestBody = {
    kind: v.kind,
    account: { platform: "x", external_id: v.accountId.trim() },
    justification: v.justification.trim(),
  };
  if (v.kind === "badge") body.category = v.category;
  else {
    body.org = { platform: "x", external_id: v.orgId.trim() };
    body.title = v.orgTitle.trim();
  }
  if (v.contact.trim()) body.contact = v.contact.trim();
  const urls = parseEvidence(v.evidence);
  if (urls.length) body.evidence_urls = urls;
  return body;
}
