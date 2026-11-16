import type { BadgeAccount, BadgeAccountDetail, BadgeAffiliation } from "~/shared/api-types";
import { send } from "~/shared/messages";
import { badgeColors } from "~/shared/palette";
import { h, safeHttps } from "./dom";
import { brandMark, icon, sealIcon } from "./icons";
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
  // shadcn-style exit (fade + zoom-out-95, 100 ms), then removal.
  card.dataset.state = "closed";
  const done = () => card.remove();
  if (typeof card.getAnimations === "function" && matchMedia?.("(prefers-reduced-motion: no-preference)").matches) {
    card.addEventListener("animationend", done, { once: true });
    setTimeout(done, 160);
  } else done();
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

function iconButton(name: "addModerator" | "flag", label: string, onclick: () => void): HTMLElement {
  // Discreet icon-only action; the translated label is both the accessible name and the native tooltip.
  return h("button", { class: "ib", type: "button", "aria-label": label, title: label, onclick }, icon(name, 18));
}

/** Badge popover: identity first (seal + category + label), affiliations, then a quiet footer. */
function body(detail: BadgeAccount | BadgeAccountDetail): Node[] {
  const { t } = ui;
  const category = t.enumLabel("badge_category", detail.category);
  const colors = badgeColors(detail.category, ui.theme, detail.color);
  const affs = ("affiliations" in detail && detail.affiliations?.length ? detail.affiliations : detail.affiliation ? [detail.affiliation] : []);
  const main = detail.affiliation;
  const label = detail.badge?.label?.trim()
    || (main ? (main.title?.trim() ? t.t("content_tip_affiliation", main.title.trim(), main.org.label) : main.org.label) : "");
  const out: Node[] = [
    h(
      "div",
      { class: "card-head" },
      sealIcon(28, colors.fill, colors.stroke),
      h("div", { class: "card-id" }, h("div", { class: "card-title" }, category), label ? h("div", { class: "card-sub" }, label) : null),
    ),
  ];
  if (affs.length) {
    out.push(
      h("div", { class: "sect" }, h("div", { class: "h" }, t.t("content_popover_affiliations")), h("ul", { class: "affs" }, ...affs.map(affiliationRow))),
    );
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
