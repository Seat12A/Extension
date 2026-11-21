import type { BadgeAccount } from "~/shared/api-types";
import { h, safeHttps } from "./dom";
import { getOverlay, place } from "./overlay";
import { ui } from "./state";

/**
 * Why the account is verified, as one sentence. The account's own name (`badge.label`)
 * is never repeated: X already shows it right next to the badge.
 */
export function badgeReason(account: BadgeAccount): string {
  const { t } = ui;
  const aff = account.affiliation;
  if (!account.badge && aff) {
    const title = aff.title?.trim();
    return title ? t.t("content_reason_affiliation_title", aff.org.label, title) : t.t("content_reason_affiliation", aff.org.label);
  }
  return t.enumLabel("content_reason", account.category);
}

/** Texts of a badge: category, the reason sentence, and the organisation logo of an affiliation. */
export function badgeTexts(account: BadgeAccount): { category: string; line: string; logo: string | null; org: string | null } {
  const category = ui.t.enumLabel("badge_category", account.category);
  const aff = !account.badge ? account.affiliation : null;
  return { category, line: badgeReason(account), logo: aff ? safeHttps(aff.org.logo_url) : null, org: aff?.org.label ?? null };
}

export function showTooltip(anchor: Element, account: BadgeAccount): void {
  const o = getOverlay();
  const { category, line, logo, org } = badgeTexts(account);
  o.tip.replaceChildren(h("div", { class: "l1" }, category));
  const row = h("div", { class: "l2" });
  if (logo && org) row.append(h("img", { src: logo, alt: ui.t.t("content_org_logo_alt", org), referrerpolicy: "no-referrer", width: 16, height: 16 }));
  row.append(h("span", {}, line));
  o.tip.append(row);
  o.tip.classList.add("on");
  place(o.tip, anchor, "above", o.tip.offsetWidth || 160);
}

export function hideTooltip(): void {
  getOverlay().tip.classList.remove("on");
}
