import type { BadgeAccount, BadgeAffiliation } from "~/shared/api-types";
import { badgeColors } from "~/shared/palette";
import { applyStyles, createHost, h, safeHttps } from "./dom";
import { sealIcon } from "./icons";
import { isPopoverOpenFor, openPopover } from "./popover";
import { registerWidget, ui } from "./state";
import { BADGE_CSS, BASE_CSS, MOTION_CSS } from "./styles";
import { hideTooltip, showTooltip } from "./tooltip";

function ariaLabel(account: BadgeAccount): string {
  const { t } = ui;
  const parts: string[] = [];
  if (account.badge) parts.push(t.t("content_badge_label", t.enumLabel("badge_category", account.badge.category)));
  if (account.affiliation) parts.push(t.t("content_affiliated_with", account.affiliation.org.label));
  return parts.join(" · ");
}

/** Organisation logo; without one, its initial on a neutral tile (never a check). */
export function orgMark(aff: BadgeAffiliation, cls: string): HTMLElement {
  const src = safeHttps(aff.org.logo_url);
  if (src) return h("img", { class: cls, src, alt: "", referrerpolicy: "no-referrer", draggable: "false" });
  const initial = Array.from(aff.org.label.trim())[0]?.toUpperCase() ?? "?";
  return h("span", { class: `${cls} initial`, "aria-hidden": "true" }, initial);
}

/**
 * `<seat12a-badge>` next to a name. Badge and affiliation are independent (Tower,
 * 2026-11-21): the coloured seal only for the account's OWN badge, the main
 * organisation's logo for an affiliation, both when it has both. `accountId` is the
 * numeric X id. Renders nothing visible when there is neither.
 */
export function createBadge(account: BadgeAccount, accountId: string): HTMLElement {
  const { host, root } = createHost("seat12a-badge");
  applyStyles(root, BASE_CSS + MOTION_CSS + BADGE_CSS);
  let button: HTMLButtonElement | null = null;

  const render = () => {
    const next = h("button", { class: "mark", type: "button", "aria-label": ariaLabel(account), "aria-haspopup": "dialog" });
    if (account.badge) {
      const colors = badgeColors(account.badge.category, ui.theme, account.badge.color);
      next.append(h("span", { class: "seal" }, sealIcon(16, colors.fill, colors.stroke)));
    }
    if (account.affiliation) next.append(orgMark(account.affiliation, "org"));
    const show = () => { if (!isPopoverOpenFor(next)) showTooltip(next, account); };
    next.addEventListener("mouseenter", show);
    next.addEventListener("focus", show);
    next.addEventListener("mouseleave", hideTooltip);
    next.addEventListener("blur", hideTooltip);
    next.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      void openPopover(next, accountId, account);
    });
    for (const type of ["mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "dblclick"]) {
      next.addEventListener(type, (e) => e.stopPropagation());
    }
    if (button) button.replaceWith(next); else root.append(next);
    button = next;
  };
  render();
  registerWidget(host, render);
  host.dataset.accountId = accountId;
  return host;
}

/**
 * Sizes the badge from the name it follows: font-size of the name (seal = 0.8em),
 * centred on capital height. Call once the host is in the DOM.
 */
export function fitToName(host: HTMLElement, nameEl: Element): void {
  const view = host.ownerDocument.defaultView;
  if (!view) return;
  const fs = view.getComputedStyle(nameEl).fontSize;
  if (/^[\d.]+px$/.test(fs)) host.style.fontSize = fs;
  // Optical gap: the seal is full-bleed (no inner whitespace, unlike icon fonts), so
  // it needs a real gap to breathe: 0.25em ≈ 4 px next to a 15 px name, 5 px at 20 px.
  host.style.marginInlineStart = "0.25em";
  host.style.marginInlineEnd = "0";
  const parent = host.parentElement;
  const display = parent ? view.getComputedStyle(parent).display : "";
  if (display.includes("flex")) {
    host.style.alignSelf = "center";
    host.style.transform = "translateY(-0.02em)";
  } else {
    host.style.display = "inline-block";
    host.style.verticalAlign = "-0.04em";
  }
}
