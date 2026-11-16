import type { BadgeAccount } from "~/shared/api-types";
import { badgeColors } from "~/shared/palette";
import { applyStyles, createHost, h } from "./dom";
import { sealIcon } from "./icons";
import { isPopoverOpenFor, openPopover } from "./popover";
import { registerWidget, ui } from "./state";
import { BADGE_CSS, BASE_CSS } from "./styles";
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
  applyStyles(root, BASE_CSS + BADGE_CSS);
  let button: HTMLButtonElement | null = null;

  const render = () => {
    const colors = badgeColors(account.category, ui.theme, account.color);
    const next = h("button", { class: "seal", type: "button", "aria-label": ariaLabel(account), "aria-haspopup": "dialog" });
    next.append(sealIcon(18, colors.fill, colors.stroke));
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
