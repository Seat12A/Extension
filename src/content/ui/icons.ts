import certif from "~/assets/brand/certif-badge.svg?raw";
import chevron from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?raw";
import openInNew from "@material-symbols/svg-400/rounded/open_in_new.svg?raw";
import translate from "@material-symbols/svg-400/rounded/translate.svg?raw";
import close from "@material-symbols/svg-400/rounded/close.svg?raw";
import flag from "@material-symbols/svg-400/rounded/flag.svg?raw";
import addModerator from "@material-symbols/svg-400/rounded/add_moderator.svg?raw";
import cancel from "@material-symbols/svg-400/rounded/cancel-fill.svg?raw";
import checkCircle from "@material-symbols/svg-400/rounded/check_circle-fill.svg?raw";
import errorFill from "@material-symbols/svg-400/rounded/error-fill.svg?raw";
import help from "@material-symbols/svg-400/rounded/help-fill.svg?raw";
import logoSky from "~/assets/brand/logo-sky.svg?raw";
import logoSunset from "~/assets/brand/logo-sunset.svg?raw";
import { parseSvg, s } from "./dom";

const RAW = { chevron, openInNew, translate, close, flag, addModerator, cancel, checkCircle, errorFill, help } as const;
export type IconName = keyof typeof RAW;

/** Material Symbol inlined with currentColor. */
export function icon(name: IconName, size = 18): SVGSVGElement {
  const svg = parseSvg(RAW[name]) ?? (s("svg") as SVGSVGElement);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return svg;
}

let seal: { d1: string; d2: string } | null = null;
function sealPaths(): { d1: string; d2: string } {
  if (!seal) {
    const svg = parseSvg(certif);
    const paths = svg ? Array.from(svg.querySelectorAll("path")) : [];
    seal = { d1: paths[0]?.getAttribute("d") ?? "", d2: paths[1]?.getAttribute("d") ?? "" };
  }
  return seal;
}

/** The Seat 12A verification seal (brand shape), recoloured. The check stays white. */
export function sealIcon(size: number, fill: string, stroke?: string): SVGSVGElement {
  const { d1, d2 } = sealPaths();
  const body = s("path", { d: d1, fill, ...(stroke ? { stroke, "stroke-width": 40, "paint-order": "stroke" } : {}) });
  return s(
    "svg",
    { viewBox: "0 0 815 815", width: size, height: size, "aria-hidden": "true", focusable: "false", style: "overflow:visible;display:block" },
    body,
    s("path", { d: d2, fill: "#fff" }),
  ) as SVGSVGElement;
}

/** Material icon expressing a veracity outcome (shape + colour, never colour alone). */
export function veracityIcon(veracity: string, size = 18): SVGSVGElement {
  const name: IconName =
    veracity === "true" || veracity === "mostly_true" ? "checkCircle"
    : veracity === "false" ? "cancel"
    : veracity === "misleading" ? "errorFill"
    : "help";
  return icon(name, size);
}

let brandSeq = 0;
/**
 * The Seat 12A brand mark (the window), NOT the verification seal: the seal means
 * "this account has a Seat 12A badge" and must never be used as the brand. Sky window
 * on light pages, sunset window on dim/dark pages. Internal ids are made unique.
 */
export function brandMark(height: number, dark: boolean): SVGSVGElement {
  const svg = parseSvg(dark ? logoSunset : logoSky) ?? (s("svg") as SVGSVGElement);
  const suffix = `-s12a${++brandSeq}`;
  for (const el of Array.from(svg.querySelectorAll("[id]"))) el.id += suffix;
  for (const el of Array.from(svg.querySelectorAll("*"))) {
    for (const attr of ["mask", "fill", "stroke", "clip-path"]) {
      const v = el.getAttribute(attr);
      if (v?.startsWith("url(#")) el.setAttribute(attr, v.replace(/\)$/, `${suffix})`));
    }
  }
  // Crop the artboard padding so the window fills its box (same crop as the popup logo).
  svg.setAttribute("viewBox", "40 45 400 510");
  svg.setAttribute("height", String(height));
  svg.setAttribute("width", String(Math.round((height * 400) / 510)));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return svg;
}
