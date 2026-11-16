import type { PublicVerdict, VerdictClaim } from "~/shared/api-types";
import { VERACITY_SEVERITY, veracityTone } from "~/shared/palette";
import { applyStyles, createHost, h, hostOf, isolateEvents, safeHttps } from "./dom";
import { icon, sealIcon } from "./icons";
import { registerWidget, ui } from "./state";
import { BASE_CSS, VERDICT_CSS } from "./styles";

function severity(v: string): number {
  const i = VERACITY_SEVERITY.indexOf(v);
  return i < 0 ? VERACITY_SEVERITY.indexOf("unverifiable") : i;
}

/** Most severe veracity among the claims. */
export function worstVeracity(claims: VerdictClaim[]): string {
  return claims.reduce((w, c) => (severity(c.veracity) < severity(w) ? c.veracity : w), claims[0]?.veracity ?? "unverifiable");
}

function chip(veracity: string): HTMLElement {
  const tone = veracityTone(veracity, ui.theme);
  const el = h("span", { class: "chip" }, ui.t.enumLabel("veracity", veracity));
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

function claimView(claim: VerdictClaim, requestedLang: string): HTMLElement {
  const { t } = ui;
  const el = h("div", { class: "claim" });
  const head = h("div", { class: "head" }, chip(claim.veracity));
  if (claim.context_need && claim.context_need !== "none") head.append(h("span", { class: "need" }, t.enumLabel("context_need", claim.context_need)));
  el.append(head, h("p", { class: "claim-text", lang: claim.lang, dir: "auto" }, claim.text));

  const note = claim.note;
  if (note) {
    el.append(h("p", { class: "note", lang: note.lang, dir: "auto" }, note.text));
    if (note.fact_sheet) el.append(h("p", { class: "sheet", lang: note.lang, dir: "auto" }, note.fact_sheet));
    const meta = h("div", { class: "meta" });
    if (note.machine_translated) meta.append(h("span", {}, icon("translate", 14), t.t("content_machine_translated")));
    if (note.lang.toLowerCase().split("-")[0] !== requestedLang.toLowerCase().split("-")[0]) meta.append(h("span", {}, t.t("content_note_lang", langName(note.lang))));
    if (meta.childNodes.length) el.append(meta);
    const links = note.links.map((l) => safeHttps(l)).filter((l): l is string => !!l);
    if (links.length) el.append(h("ul", { class: "links", "aria-label": t.t("content_sources") }, ...links.map((u) => h("li", {}, externalLink(u, "link", hostOf(u))))));
  }

  const origin = safeHttps(claim.inherited?.origin_url ?? null);
  if (claim.inherited) {
    const meta = h("div", { class: "meta" }, h("span", {}, t.t("content_inherited")));
    if (origin) meta.append(externalLink(origin, "", t.t("content_inherited_link")));
    el.append(meta);
  }
  try {
    if (claim.validated_at) el.append(h("div", { class: "meta" }, h("span", {}, t.t("content_validated_on", t.date(claim.validated_at)))));
  } catch { /* invalid date: omit */ }
  return el;
}

/** `<seat12a-verdict>`: collapsed pill + details panel for a post with a validated verdict. */
export function createVerdict(verdict: PublicVerdict): HTMLElement {
  const { host, root } = createHost("seat12a-verdict");
  applyStyles(root, BASE_CSS + VERDICT_CSS);
  const container = h("div", {});
  root.append(container);
  let expanded = false;

  const render = () => {
    const { t } = ui;
    const claims = verdict.claims;
    const worst = worstVeracity(claims);
    const panelId = "seat12a-panel";
    const row = h(
      "button",
      { class: "row", type: "button", "aria-expanded": expanded ? "true" : "false", "aria-controls": panelId, "aria-label": t.t("content_verdict_label", t.enumLabel("veracity", worst)) },
      sealIcon(16, ui.theme === "light" ? "#006AFF" : "#208BFE"),
      h("span", { class: "brand" }, t.t("content_brand")),
      h("span", { class: "sep" }),
      chip(worst),
      claims.length > 1 ? h("span", { class: "count" }, t.tp("content_claims_count", claims.length)) : null,
      h("span", { class: "chev" }, icon("chevron", 18)),
    );
    row.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      expanded = !expanded;
      render();
      (root.querySelector(".row") as HTMLElement | null)?.focus({ preventScroll: true });
    });
    const nodes: Node[] = [row];
    if (expanded) {
      const panel = h("div", { class: "panel", id: panelId }, ...claims.map((c) => claimView(c, ui.t.lang)));
      const url = safeHttps(verdict.url);
      if (url) panel.append(h("div", { class: "foot" }, externalLink(url, "", t.t("content_view_on_site"))));
      nodes.push(panel);
    }
    container.replaceChildren(...nodes);
  };
  render();
  isolateEvents(container);
  registerWidget(host, render);
  return host;
}
