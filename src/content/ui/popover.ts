import type { BadgeAccount, BadgeAccountDetail, BadgeAffiliation } from "~/shared/api-types";
import { send } from "~/shared/messages";
import { badgeColors } from "~/shared/palette";
import { h } from "./dom";
import { brandMark, icon, sealIcon } from "./icons";
import { getOverlay, place } from "./overlay";
import { ui } from "./state";
import { badgeReason, badgeTitle, logoImg } from "./tooltip";

interface Open { card: HTMLElement; anchor: HTMLElement; cleanup: () => void }
let current: Open | null = null;

export function isPopoverOpenFor(anchor: Element): boolean {
  return current?.anchor === anchor;
}

export function closePopover(restoreFocus = true): void {
  if (!current) return;
  const { card, anchor, cleanup } = current;
  current = null;
  cleanup();
  // shadcn-style exit (fade + zoom-out-95, 100 ms), then removal.
  card.dataset.state = "closed";
  const done = () => card.remove();
  if (typeof card.getAnimations === "function" && matchMedia?.("(prefers-reduced-motion: no-preference)").matches) {
    card.addEventListener("animationend", done, { once: true });
    setTimeout(done, 160);
  } else done();
  if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
}

function affiliationRow(a: BadgeAffiliation): HTMLElement {
  const title = a.title?.trim();
  return h(
    "li",
    { class: "aff" },
    logoImg(a, "logo", 24),
    h("div", { class: "aff-t" }, h("span", {}, a.org.label), title ? h("small", {}, title) : null),
  );
}

function openOptions(hash: string): void {
  void send({ type: "openOptions", hash }).catch(() => {});
  closePopover(false);
}

function iconButton(name: "addModerator" | "flag", label: string, onclick: () => void): HTMLElement {
  // Discreet icon-only action; the translated label is both the accessible name and the native tooltip.
  return h("button", { class: "ib", type: "button", "aria-label": label, title: label, onclick }, icon(name, 18));
}

/**
 * Badge popover. Own badge first (seal + "Category · field" + why it is verified), then
 * the affiliations (organisation logos, never a check). The account's name is not repeated.
 */
function body(detail: BadgeAccount | BadgeAccountDetail): Node[] {
  const { t } = ui;
  const out: Node[] = [];
  if (detail.badge) {
    const colors = badgeColors(detail.badge.category, ui.theme, detail.badge.color);
    out.push(h(
      "div",
      { class: "card-head" },
      sealIcon(28, colors.fill, colors.stroke),
      h("div", { class: "card-id" }, h("div", { class: "card-title" }, badgeTitle(detail) ?? ""), h("div", { class: "card-sub" }, badgeReason(detail) ?? "")),
    ));
  }
  if (detail.affiliations.length) {
    out.push(h(
      "div",
      { class: detail.badge ? "sect" : "sect first" },
      h("div", { class: "h" }, t.t(detail.badge ? "content_popover_affiliations" : "content_affiliated_title")),
      h("ul", { class: "affs" }, ...detail.affiliations.map(affiliationRow)),
    ));
  }
  return out;
}

function footer(accountId: string): HTMLElement {
  const { t } = ui;
  const [before = "", after = ""] = t.t("content_verified_by", "\u0000").split("\u0000");
  return h(
    "div",
    { class: "card-foot" },
    h("span", { class: "by" }, brandMark(14, ui.theme !== "light"), h("span", {}, before, h("strong", {}, t.t("content_brand")), after)),
    h(
      "span",
      { class: "acts" },
      iconButton("addModerator", t.t("content_action_request"), () => openOptions(`request?account=${encodeURIComponent(accountId)}`)),
      iconButton("flag", t.t("content_action_report"), () => openOptions(`report?account=${encodeURIComponent(accountId)}`)),
    ),
  );
}

/** Popover card (one at a time). Shows the badge at once, then enriches it with account details. */
export async function openPopover(anchor: HTMLElement, accountId: string, account: BadgeAccount): Promise<void> {
  if (isPopoverOpenFor(anchor)) { closePopover(); return; }
  closePopover(false);
  const { t } = ui;
  const o = getOverlay();
  const card = h("div", { class: "card", role: "dialog", "aria-label": t.t("content_popover_label"), tabindex: -1 });
  const fill = (nodes: Node[], status?: string) => {
    card.replaceChildren(...nodes);
    if (status) card.append(h("p", { class: "status", role: "status" }, status));
    card.append(footer(accountId));
    place(card, anchor, "below", 280, "start");
  };

  fill(body(account), t.t("content_popover_loading"));
  o.layer.append(card);
  place(card, anchor, "below", 280, "start");

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); closePopover(); return; }
    if (e.key !== "Tab") return;
    const items = Array.from(card.querySelectorAll<HTMLElement>("button, a[href]"));
    if (!items.length) return;
    const active = o.root.activeElement as HTMLElement | null;
    const first = items[0]!, last = items[items.length - 1]!;
    if (e.shiftKey && (active === first || !card.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !card.contains(active))) { e.preventDefault(); first.focus(); }
  };
  const onDown = (e: Event) => {
    const path = e.composedPath();
    if (!path.includes(card) && !path.includes(anchor)) closePopover(false);
  };
  const onScroll = (e: Event) => {
    if (!e.composedPath().includes(card)) closePopover(false);
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onDown, true);
  window.addEventListener("scroll", onScroll, true);
  current = {
    card,
    anchor,
    cleanup: () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    },
  };
  card.focus({ preventScroll: true });

  try {
    const detail = await send({ type: "getAccountDetail", id: accountId });
    if (current?.card !== card) return;
    if (detail) fill(body(detail));
    else fill(body(account));
  } catch {
    if (current?.card !== card) return;
    fill(body(account), t.t("content_popover_error"));
  }
  if (current?.card === card && !o.root.activeElement) card.focus({ preventScroll: true });
}
