import type { BadgeAccount } from "~/shared/api-types";
import { badgeColors } from "~/shared/palette";
import { applyStyles, createHost, h } from "./dom";
import { sealIcon } from "./icons";
import { isPopoverOpenFor, openPopover } from "./popover";
import { registerWidget, ui } from "./state";
import { BADGE_CSS, BASE_CSS, MOTION_CSS } from "./styles";
import { hideTooltip, showTooltip } from "./tooltip";

function ariaLabel(account: BadgeAccount): string {
  const { t } = ui;
  const category = t.enumLabel("badge_category", account.category);
  const aff = account.affiliation;
  if (aff && !account.badge) return t.t("content_badge_label_affiliation", aff.title?.trim() || category, aff.org.label);
  return t.t("content_badge_label", category);
}

/** `<seat12a-badge>`: the Seat 12A seal for an account. `accountId` is the numeric X id. */
export function createBadge(account: BadgeAccount, accountId: string): HTMLElement {
  const { host, root } = createHost("seat12a-badge");
  applyStyles(root, BASE_CSS + MOTION_CSS + BADGE_CSS);
  let button: HTMLButtonElement | null = null;

  const render = () => {
    const colors = badgeColors(account.category, ui.theme, account.color);
    const next = h("button", { class: "seal", type: "button", "aria-label": ariaLabel(account), "aria-haspopup": "dialog" });
    next.append(sealIcon(16, colors.fill, colors.stroke));
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
 * Sizes the badge from the name it follows: font-size of the name (badge = 0.8em),
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
