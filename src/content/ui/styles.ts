/** CSS strings for the shadow roots. Tokens follow X's theme through `data-theme` on the host. */
export const BASE_CSS = `
:host { all: initial; font-family: "Seat12A Google Sans", system-ui, sans-serif; color: var(--text); font-size: 13px; line-height: 1.35; -webkit-font-smoothing: antialiased; }
:host, :host([data-theme="light"]) { --text:#0f1419; --text2:#536471; --line:#dce2ea; --surface:#ffffff; --muted:#f7f9f9; --link:#006aff; --hover:rgba(15,20,25,.06); }
:host([data-theme="dim"]) { --text:#f7f9f9; --text2:#8b98a5; --line:#38444d; --surface:#15202b; --muted:#1e2732; --link:#208bfe; --hover:rgba(247,249,249,.08); }
:host([data-theme="dark"]) { --text:#e7e9ea; --text2:#71767b; --line:#2f3336; --surface:#000000; --muted:#16181c; --link:#208bfe; --hover:rgba(231,233,234,.08); }
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; color: inherit; margin: 0; padding: 0; border: 0; background: none; cursor: pointer; text-align: inherit; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
svg { display: block; flex: none; }
`;

/**
 * Motion, aligned on shadcn/ui (tw-animate-css): enter = fade + zoom-in-95 + 2-4 px
 * slide from the anchor side, 150 ms; exit = fade + zoom-out-95, 100 ms; hovers 120 ms.
 * Easing: fast ease-out (cubic-bezier(.16,1,.3,1)). Disabled with prefers-reduced-motion.
 */
export const MOTION_CSS = `
@keyframes s12a-in { from { opacity: 0; transform: translateY(var(--s12a-dy, 0)) scale(var(--s12a-scale, .95)); } }
@keyframes s12a-out { to { opacity: 0; transform: scale(.95); } }
@keyframes s12a-fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;

export const BADGE_CSS = `
:host { display: inline-flex; line-height: 0; flex-shrink: 0; }
.mark { display: inline-flex; align-items: center; gap: 0.2em; height: 0.85em; border-radius: 0.2em; cursor: pointer; }
.seal { display: inline-flex; width: 0.8em; height: 0.8em; }
.seal svg { width: 100%; height: 100%; }
/* Organisation logo of an affiliation: a small rounded tile, never a check. */
.org { display: inline-flex; align-items: center; justify-content: center; width: 0.85em; height: 0.85em; border-radius: 0.2em; object-fit: cover; background: var(--muted); box-shadow: 0 0 0 1px var(--line); }
.org.initial { color: var(--text2); font: 700 0.55em/1 "Seat12A Google Sans", system-ui, sans-serif; width: 1.55em; height: 1.55em; border-radius: 0.36em; }
.mark { --s12a-scale: .6; animation: s12a-in 180ms cubic-bezier(.16,1,.3,1); transition: opacity 120ms ease, transform 120ms ease; }
.mark:active { transform: scale(.9); }
.mark:hover { opacity: .85; }
`;

export const VERDICT_CSS = `
:host { display: block; margin: 12px 0 4px; }
.card.enter { --s12a-dy: -4px; --s12a-scale: 1; animation: s12a-in 180ms cubic-bezier(.16,1,.3,1); }
.panel { --s12a-dy: -4px; --s12a-scale: 1; animation: s12a-in 160ms cubic-bezier(.16,1,.3,1); }
.foot { animation: s12a-fade 200ms ease-out; }
/* One card, two states. Header = outcome first (icon + label in the outcome tone),
   brand last. The brand is the Seat 12A window, never the account verification seal. */
.card { border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--muted); }
.row { transition: background-color 120ms ease; display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 10px 12px 10px 14px; cursor: pointer; }
.row > * { line-height: 1; }
.row:hover { background: var(--hover); }
.row:focus { outline: none; }
.row:focus-visible { outline: 2px solid var(--link); outline-offset: -3px; border-radius: 15px; }
.chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px 0 7px; border: 1px solid var(--bd); border-radius: 999px; background: var(--bg); color: var(--fg); font-size: 14px; font-weight: 700; letter-spacing: -.005em; line-height: 1; white-space: nowrap; }
.chip.sm { height: 22px; padding: 0 8px 0 6px; gap: 4px; font-size: 12px; }
.count { color: var(--text2); font-size: 13px; white-space: nowrap; }
.count::before { content: "·"; margin-inline-end: 8px; }
.spacer { flex: 1; min-width: 8px; }
.brand { display: inline-flex; align-items: center; gap: 6px; color: var(--text2); font-size: 13px; font-weight: 600; white-space: nowrap; }
.chev { display: inline-flex; color: var(--text2); transition: transform 180ms cubic-bezier(.16,1,.3,1); margin-inline-start: 2px; }
.row[aria-expanded="true"] .chev { transform: rotate(180deg); }
.open .row { border-bottom: 1px solid var(--line); }
.panel { padding: 4px 16px; }
.claim { padding: 14px 0; }
.claim + .claim { border-top: 1px solid var(--line); }
.ctag { display: flex; margin-bottom: 8px; }
.claim-text { margin: 0; color: var(--text); font-size: 15px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.note { margin: 6px 0 0; color: var(--text); font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-wrap; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; margin-top: 10px; color: var(--text2); font-size: 13px; line-height: 1.3; }
.srcs { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; }
.src { transition: opacity 120ms ease; display: inline-flex; align-items: center; gap: 3px; font-weight: 500; }
.src svg { opacity: .8; }
.q { display: inline-flex; align-items: center; gap: 4px; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 13px; }
.when { color: var(--text2); }
.foot a { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; white-space: nowrap; }
`;

export const OVERLAY_CSS = `
:host { position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 2147483647; display: block; }
.tip { position: fixed; display: none; max-width: 260px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--text); pointer-events: none; font-size: 13px; line-height: 1.3; }
.tip.on { display: block; animation: s12a-in 120ms cubic-bezier(.16,1,.3,1); }
.tip[data-side=top] { --s12a-dy: 4px; } .tip[data-side=bottom] { --s12a-dy: -4px; }
.tip .l1 { font-weight: 700; }
.tip .l2 { display: flex; align-items: flex-start; gap: 6px; margin-top: 2px; color: var(--text2); }
.tip .affs-tip { display: grid; gap: 4px; margin-top: 6px; }
.tip .affs-tip .l2 { align-items: center; margin-top: 0; }
.tip .initial, .aff .initial { display: inline-flex; align-items: center; justify-content: center; color: var(--text2); font-weight: 700; font-size: 10px; line-height: 1; box-shadow: 0 0 0 1px var(--line); }
.aff .initial { font-size: 12px; }
.tip img, .logo { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; flex: none; background: var(--muted); }
.card { position: fixed; width: 280px; max-width: calc(100vw - 16px); padding: 16px 16px 0; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: 0 8px 28px rgba(0,0,0,.16); outline: none; }
:host([data-theme="dim"]) .card, :host([data-theme="dark"]) .card { box-shadow: 0 0 0 1px rgba(255,255,255,.02), 0 8px 28px rgba(0,0,0,.5); }
.card { animation: s12a-in 150ms cubic-bezier(.16,1,.3,1); }
.card[data-side=top] { --s12a-dy: 6px; } .card[data-side=bottom] { --s12a-dy: -6px; }
.card[data-state=closed] { animation: s12a-out 100ms ease-in forwards; pointer-events: none; }
.card-head { display: flex; align-items: center; gap: 12px; }
.card-head > svg { flex: none; }
.card-id { min-width: 0; }
.card-title { font-size: 16px; font-weight: 700; letter-spacing: -.01em; line-height: 1.25; }
.card-sub { margin-top: 2px; color: var(--text2); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
.status { margin: 12px 0 0; color: var(--text2); font-size: 12px; }
.sect { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.sect.first { margin-top: 0; padding-top: 0; border-top: 0; }
.h { margin: 0 0 8px; color: var(--text2); font-size: 12px; font-weight: 600; }
.affs { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.aff { display: flex; align-items: center; gap: 10px; }
.aff .logo { width: 24px; height: 24px; border-radius: 6px; }
.aff-t { min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 500; line-height: 1.3; }
.aff-t small { display: block; color: var(--text2); font-size: 12px; font-weight: 400; }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; padding: 8px 0 10px; border-top: 1px solid var(--line); }
.by { display: inline-flex; align-items: center; gap: 6px; color: var(--text2); font-size: 12px; }
.by strong { color: var(--text); font-weight: 600; }
.acts { display: inline-flex; gap: 2px; margin-inline-end: -6px; }
.ib { transition: background-color 120ms ease, color 120ms ease, transform 120ms ease; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; color: var(--text2); }
.ib:hover { background: var(--hover); color: var(--text); }
.ib:active { transform: scale(.92); }
`;
