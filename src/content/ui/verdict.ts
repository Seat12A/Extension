import type { PublicVerdict, VerdictClaim } from "~/shared/api-types";
import { VERACITY_SEVERITY, veracityTone } from "~/shared/palette";
import { applyStyles, createHost, h, hostOf, isolateEvents, safeHttps } from "./dom";
import { brandMark, icon, veracityIcon } from "./icons";
import { registerWidget, ui } from "./state";
import { BASE_CSS, MOTION_CSS, VERDICT_CSS } from "./styles";

function severity(v: string): number {
  const i = VERACITY_SEVERITY.indexOf(v);
  return i < 0 ? VERACITY_SEVERITY.indexOf("unverifiable") : i;
}

/** Most severe veracity among the claims. */
export function worstVeracity(claims: VerdictClaim[]): string {
  return claims.reduce((w, c) => (severity(c.veracity) < severity(w) ? c.veracity : w), claims[0]?.veracity ?? "unverifiable");
}

/** Outcome pill: tinted background + thin border in the outcome tone, icon + label. */
function chip(veracity: string, size: "md" | "sm" = "md"): HTMLElement {
  const tone = veracityTone(veracity, ui.theme);
  const el = h("span", { class: `chip ${size}` }, veracityIcon(veracity, size === "md" ? 16 : 14), h("span", {}, ui.t.enumLabel("veracity", veracity)));
  el.style.setProperty("--fg", tone.fg);
  el.style.setProperty("--bg", tone.bg);
  el.style.setProperty("--bd", tone.border);
  return el;
}

function langName(code: string): string {
  try { return new Intl.DisplayNames([ui.t.lang], { type: "language" }).of(code) ?? code; } catch { return code; }
}

function externalLink(url: string, cls: string, label: string, text = label): HTMLElement {
  return h(
    "a",
    { class: cls, href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": ui.t.t("content_external_link", label) },
    h("span", {}, text),
    icon("openInNew", 14),
  );
}

/**
 * One claim, three levels only:
 *   1. the claim (heading; its outcome icon + label only when the post has several claims,
 *      the card header already states it otherwise),
 *   2. the note (main content),
 *   3. one quiet line: sources as links, translation / language notice, inherited origin.
 */
function claimView(claim: VerdictClaim, requestedLang: string, several: boolean): HTMLElement {
  const { t } = ui;
  const el = h("div", { class: "claim" });
  if (several) {
    el.append(h("div", { class: "ctag" }, chip(claim.veracity, "sm")));
  }
  el.append(h("p", { class: "claim-text", lang: claim.lang, dir: "auto" }, claim.text));

  const note = claim.note;
  if (note) el.append(h("p", { class: "note", lang: note.lang, dir: "auto" }, note.text));

  const meta = h("div", { class: "meta" });
  const links = (note?.links ?? []).map((l) => safeHttps(l)).filter((l): l is string => !!l);
  if (links.length) {
    meta.append(h("span", { class: "srcs", role: "list", "aria-label": t.t("content_sources") }, ...links.map((u) => h("span", { role: "listitem" }, externalLink(u, "src", hostOf(u))))));
  }
  if (note) {
    const otherLang = note.lang.toLowerCase().split("-")[0] !== requestedLang.toLowerCase().split("-")[0];
    if (note.machine_translated) meta.append(h("span", { class: "q" }, icon("translate", 14), otherLang ? t.t("content_translated_from", langName(note.lang)) : t.t("content_machine_translated")));
    else if (otherLang) meta.append(h("span", { class: "q" }, t.t("content_note_lang", langName(note.lang))));
  }
  const origin = safeHttps(claim.inherited?.origin_url ?? null);
  if (claim.inherited && origin) meta.append(externalLink(origin, "src", t.t("content_inherited_link")));
  if (meta.childNodes.length) el.append(meta);
  return el;
}

function latest(claims: VerdictClaim[]): string | null {
  const ts = claims.map((c) => Date.parse(c.validated_at)).filter((n) => !Number.isNaN(n));
  return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
}

/** `<seat12a-verdict>`: collapsed pill + details panel for a post with a validated verdict. */
export function createVerdict(verdict: PublicVerdict): HTMLElement {
  const { host, root } = createHost("seat12a-verdict");
  applyStyles(root, BASE_CSS + MOTION_CSS + VERDICT_CSS);
  const container = h("div", {});
  root.append(container);
  let expanded = false;
  let firstRender = true; // entrance animation only when the card first appears

  const render = () => {
    const { t } = ui;
    const claims = verdict.claims;
    const worst = worstVeracity(claims);
    const panelId = "seat12a-panel";
    const tone = veracityTone(worst, ui.theme);
    const dark = ui.theme !== "light";
    const row = h(
      "button",
      { class: "row", type: "button", "aria-expanded": expanded ? "true" : "false", "aria-controls": panelId, "aria-label": t.t("content_verdict_label", t.enumLabel("veracity", worst)) },
      chip(worst),
      claims.length > 1 ? h("span", { class: "count" }, t.tp("content_claims_count", claims.length)) : null,
      h("span", { class: "spacer" }),
      h("span", { class: "brand" }, brandMark(16, dark), h("span", {}, t.t("content_brand"))),
      h("span", { class: "chev" }, icon("chevron", 20)),
    );
    const card = h("div", { class: `card${expanded ? " open" : ""}${firstRender ? " enter" : ""}` });
    firstRender = false;
    card.style.setProperty("--tfg", tone.fg);
    card.style.setProperty("--tbg", tone.bg);
    card.style.setProperty("--tbd", tone.border);
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Keep keyboard focus on the toggle after re-render, but never paint a focus
      // ring after a mouse click (focus-visible only follows keyboard use).
      const keyboard = row.matches(":focus-visible");
      expanded = !expanded;
      render();
      if (keyboard) (root.querySelector(".row") as HTMLElement | null)?.focus({ preventScroll: true });
    });
    card.append(row);
    if (expanded) {
      const panel = h("div", { class: "panel", id: panelId }, ...claims.map((c) => claimView(c, ui.t.lang, claims.length > 1)));
      card.append(panel);
      const url = safeHttps(verdict.url);
      const when = latest(claims);
      let date: string | null = null;
      try { date = when ? t.t("content_validated_on", t.date(when)) : null; } catch { date = null; }
      if (url || date) card.append(h("div", { class: "foot" }, h("span", { class: "when" }, date ?? ""), url ? externalLink(url, "", t.t("content_view_on_site")) : null));
    }
    const nodes: Node[] = [card];
    container.replaceChildren(...nodes);
  };
  render();
  isolateEvents(container);
  registerWidget(host, render);
  return host;
}
