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

export const BADGE_CSS = `
:host { display: inline-flex; vertical-align: middle; line-height: 0; }
.seal { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; }
.seal:hover { opacity: .85; }
`;

export const VERDICT_CSS = `
:host { display: block; margin: 8px 0; }
.row { display: inline-flex; align-items: center; gap: 8px; height: 32px; max-width: 100%; padding: 0 8px 0 10px; border: 1px solid var(--line); border-radius: 999px; cursor: pointer; }
.row:hover { background: var(--hover); }
.brand { font-weight: 600; letter-spacing: -.005em; white-space: nowrap; }
.sep { width: 1px; height: 14px; background: var(--line); }
.chip { display: inline-flex; align-items: center; height: 22px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--bd); background: var(--bg); color: var(--fg); font-size: 12px; font-weight: 600; white-space: nowrap; }
.count { color: var(--text2); white-space: nowrap; }
.chev { color: var(--text2); transition: transform .15s ease; }
.row[aria-expanded="true"] .chev { transform: rotate(180deg); }
.panel { margin-top: 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--muted); padding: 12px; font-size: 14px; }
.claim + .claim { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.need { color: var(--text2); font-size: 12px; }
.claim-text { margin: 0; font-size: 15px; line-height: 1.35; font-weight: 600; overflow-wrap: anywhere; }
.note { margin: 8px 0 0; color: var(--text); overflow-wrap: anywhere; white-space: pre-wrap; }
.sheet { margin: 6px 0 0; color: var(--text2); font-size: 13px; overflow-wrap: anywhere; white-space: pre-wrap; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; color: var(--text2); font-size: 12px; }
.meta span, .meta a { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.links { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.link { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; height: 26px; padding: 0 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-size: 12px; font-weight: 500; }
.link:hover { text-decoration: none; background: var(--hover); }
.foot { display: flex; justify-content: flex-end; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 13px; font-weight: 600; }
.foot a { display: inline-flex; align-items: center; gap: 4px; }
`;

export const OVERLAY_CSS = `
:host { position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 2147483647; display: block; }
.tip { position: fixed; display: none; max-width: 260px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--text); pointer-events: none; font-size: 13px; line-height: 1.3; }
.tip.on { display: block; }
.tip .l1 { font-weight: 700; }
.tip .l2 { display: flex; align-items: center; gap: 6px; margin-top: 2px; color: var(--text2); }
.tip img, .logo { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; flex: none; background: var(--muted); }
.card { position: fixed; width: 300px; max-width: calc(100vw - 16px); padding: 14px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: 0 8px 28px rgba(0,0,0,.18); }
.card-head { display: flex; align-items: center; gap: 10px; }
.card-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; }
.x { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; color: var(--text2); }
.x:hover { background: var(--hover); }
.label { margin: 8px 0 0; color: var(--text); overflow-wrap: anywhere; }
.status { margin: 10px 0 0; color: var(--text2); }
.h { margin: 12px 0 6px; color: var(--text2); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.affs { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.aff { display: flex; align-items: center; gap: 8px; }
.aff .logo { width: 20px; height: 20px; border-radius: 6px; }
.aff-t { min-width: 0; overflow-wrap: anywhere; }
.aff-t small { display: block; color: var(--text2); font-size: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; font-weight: 600; }
.pill:hover { background: var(--hover); }
.pill.primary { border-color: var(--link); color: var(--link); }
.card-foot { display: flex; align-items: center; gap: 6px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); color: var(--text2); font-size: 12px; font-weight: 600; }
`;
