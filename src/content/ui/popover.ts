import type { BadgeAccount, BadgeAccountDetail, BadgeAffiliation } from "~/shared/api-types";
import { send } from "~/shared/messages";
import { badgeColors } from "~/shared/palette";
import { h, safeHttps } from "./dom";
import { icon, sealIcon } from "./icons";
import { getOverlay, place } from "./overlay";
import { ui } from "./state";

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
  card.remove();
  if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
}

function logoOf(a: BadgeAffiliation): HTMLElement | null {
  const src = safeHttps(a.org.logo_url);
  return src ? h("img", { class: "logo", src, alt: ui.t.t("content_org_logo_alt", a.org.label), referrerpolicy: "no-referrer", width: 20, height: 20 }) : null;
}

function affiliationRow(a: BadgeAffiliation): HTMLElement {
  const title = a.title?.trim();
  return h(
    "li",
    { class: "aff" },
    logoOf(a),
    h("div", { class: "aff-t" }, h("span", {}, a.org.label), title ? h("small", {}, title) : null),
  );
}

function openOptions(hash: string): void {
  void send({ type: "openOptions", hash }).catch(() => {});
  closePopover(false);
}

function body(detail: BadgeAccount | BadgeAccountDetail, accountId: string): Node[] {
  const { t } = ui;
  const category = t.enumLabel("badge_category", detail.category);
  const colors = badgeColors(detail.category, ui.theme, detail.color);
  const affs = ("affiliations" in detail && detail.affiliations?.length ? detail.affiliations : detail.affiliation ? [detail.affiliation] : []);
  const label = detail.badge?.label?.trim();
  const out: Node[] = [];
  out.push(h("div", { class: "card-head" }, sealIcon(22, colors.fill, colors.stroke), h("div", { class: "card-title" }, category)));
  if (label) out.push(h("p", { class: "label" }, label));
  if (affs.length) {
    out.push(h("div", { class: "h" }, t.t("content_popover_affiliations")));
    out.push(h("ul", { class: "affs" }, ...affs.map(affiliationRow)));
  }
  out.push(
    h(
      "div",
      { class: "actions" },
      h("button", { class: "pill primary", type: "button", onclick: () => openOptions(`request?account=${encodeURIComponent(accountId)}`) }, icon("addModerator", 16), t.t("content_action_request")),
      h("button", { class: "pill", type: "button", onclick: () => openOptions(`report?account=${encodeURIComponent(accountId)}`) }, icon("flag", 16), t.t("content_action_report")),
    ),
  );
  return out;
}

/** Popover card (one at a time). Shows the badge at once, then enriches it with account details. */
export async function openPopover(anchor: HTMLElement, accountId: string, account: BadgeAccount): Promise<void> {
  if (isPopoverOpenFor(anchor)) { closePopover(); return; }
  closePopover(false);
  const { t } = ui;
  const o = getOverlay();
  const closeBtn = h("button", { class: "x", type: "button", "aria-label": t.t("content_popover_close"), onclick: () => closePopover() }, icon("close", 18));
  const card = h("div", { class: "card", role: "dialog", "aria-label": t.t("content_popover_label"), tabindex: -1 });
  const footer = () => h("div", { class: "card-foot" }, sealIcon(14, "#006AFF"), h("span", {}, t.t("content_brand")));
  const fill = (nodes: Node[], status?: string) => {
    card.replaceChildren(...nodes);
    const head = card.querySelector(".card-head");
    head?.append(closeBtn);
    if (status) card.append(h("p", { class: "status", role: "status" }, status));
    card.append(footer());
    place(card, anchor, "below", 300, "start");
  };

  fill(body(account, accountId), t.t("content_popover_loading"));
  o.layer.append(card);
  place(card, anchor, "below", 300, "start");

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
  closeBtn.focus({ preventScroll: true });

  try {
    const detail = await send({ type: "getAccountDetail", id: accountId });
    if (current?.card !== card) return;
    if (detail) fill(body(detail, accountId));
    else fill(body(account, accountId));
  } catch {
    if (current?.card !== card) return;
    fill(body(account, accountId), t.t("content_popover_error"));
  }
  if (current?.card === card && !o.root.activeElement) closeBtn.focus({ preventScroll: true });
}
