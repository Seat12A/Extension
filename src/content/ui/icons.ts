import certif from "~/assets/brand/certif-badge.svg?raw";
import chevron from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?raw";
import openInNew from "@material-symbols/svg-400/rounded/open_in_new.svg?raw";
import translate from "@material-symbols/svg-400/rounded/translate.svg?raw";
import close from "@material-symbols/svg-400/rounded/close.svg?raw";
import flag from "@material-symbols/svg-400/rounded/flag.svg?raw";
import addModerator from "@material-symbols/svg-400/rounded/add_moderator.svg?raw";
import { parseSvg, s } from "./dom";

const RAW = { chevron, openInNew, translate, close, flag, addModerator } as const;
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
