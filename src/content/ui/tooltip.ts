import type { BadgeAccount, BadgeAffiliation } from "~/shared/api-types";
import { h, safeHttps } from "./dom";
import { getOverlay, place } from "./overlay";
import { ui } from "./state";

/** "Expert · épidémiologie": category of the OWN badge, with the expert's field when known. */
export function badgeTitle(account: BadgeAccount): string | null {
  const b = account.badge;
  if (!b) return null;
  const category = ui.t.enumLabel("badge_category", b.category);
  const field = b.expertise?.trim();
  return field ? `${category} · ${field}` : category;
}

/**
 * Why the account is verified, as one sentence (own badge only: an affiliation is not a
 * verification). The account's own name (`badge.label`) is never repeated: X already
 * shows it right next to the badge.
 */
export function badgeReason(account: BadgeAccount): string | null {
  return account.badge ? ui.t.enumLabel("content_reason", account.badge.category) : null;
}

/** "Reporter · Le Journal" (or the organisation alone). */
export function affiliationText(a: BadgeAffiliation): string {
  const title = a.title?.trim();
  return title ? `${a.org.label} · ${title}` : a.org.label;
}

export function logoImg(a: BadgeAffiliation, cls: string, size: number): HTMLElement {
  const src = safeHttps(a.org.logo_url);
  if (src) return h("img", { class: cls, src, alt: ui.t.t("content_org_logo_alt", a.org.label), referrerpolicy: "no-referrer", width: size, height: size });
  const initial = Array.from(a.org.label.trim())[0]?.toUpperCase() ?? "?";
  return h("span", { class: `${cls} initial`, "aria-hidden": "true" }, initial);
}

export function showTooltip(anchor: Element, account: BadgeAccount): void {
  const o = getOverlay();
  const { t } = ui;
  const title = badgeTitle(account);
  const reason = badgeReason(account);
  const nodes: Node[] = [];
  if (title) nodes.push(h("div", { class: "l1" }, title));
  if (reason) nodes.push(h("div", { class: "l2" }, h("span", {}, reason)));
  if (account.affiliations.length) {
    if (!title) nodes.push(h("div", { class: "l1" }, t.t("content_affiliated_title")));
    nodes.push(h("div", { class: "affs-tip" }, ...account.affiliations.map((a) => h("div", { class: "l2" }, logoImg(a, "", 16), h("span", {}, affiliationText(a))))));
  }
  o.tip.replaceChildren(...nodes);
  o.tip.classList.add("on");
  place(o.tip, anchor, "above", o.tip.offsetWidth || 160);
}

export function hideTooltip(): void {
  getOverlay().tip.classList.remove("on");
}
