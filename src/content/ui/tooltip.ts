import type { BadgeAccount } from "~/shared/api-types";
import { h, safeHttps } from "./dom";
import { getOverlay, place } from "./overlay";
import { ui } from "./state";

/** Texts of a badge: category, and either its label or "title · organisation" (+ logo). */
export function badgeTexts(account: BadgeAccount): { category: string; line: string | null; logo: string | null; org: string | null } {
  const { t } = ui;
  const category = t.enumLabel("badge_category", account.category);
  const own = account.badge?.label?.trim();
  const aff = account.affiliation;
  if (own) return { category, line: own, logo: null, org: null };
  if (aff) {
    const title = aff.title?.trim();
    const line = title ? t.t("content_tip_affiliation", title, aff.org.label) : aff.org.label;
    return { category, line, logo: safeHttps(aff.org.logo_url), org: aff.org.label };
  }
  return { category, line: null, logo: null, org: null };
}

export function showTooltip(anchor: Element, account: BadgeAccount): void {
  const o = getOverlay();
  const { category, line, logo, org } = badgeTexts(account);
  o.tip.replaceChildren(h("div", { class: "l1" }, category));
  if (line) {
    const row = h("div", { class: "l2" });
    if (logo && org) row.append(h("img", { src: logo, alt: ui.t.t("content_org_logo_alt", org), referrerpolicy: "no-referrer", width: 16, height: 16 }));
    row.append(h("span", {}, line));
    o.tip.append(row);
  }
  o.tip.classList.add("on");
  place(o.tip, anchor, "above", o.tip.offsetWidth || 160);
}

export function hideTooltip(): void {
  getOverlay().tip.classList.remove("on");
}
