/**
 * Translation module shared by every context (content script, popup, options, worker).
 *
 * Why not only chrome.i18n: it follows the browser language and cannot be changed at
 * runtime, while the user can pick a language in the options. Messages are therefore
 * bundled from `src/locales/<lang>/*.json` (same files the build turns into
 * `_locales/<lang>/messages.json`) and resolved in this order:
 *   chosen language → English → chrome.i18n.getMessage → generic fallback key.
 * Adding a language = adding a `src/locales/<lang>/` folder and its code to
 * SUPPORTED_LANGS. No other code change.
 *
 * Message format: Chrome's `{ "key": { "message": "…", "description": "…" } }`.
 * Positional substitutions `$1`…`$9` (never concatenate sentence pieces).
 */
import { SUPPORTED_LANGS, type Lang } from "./constants";
import type { LanguagePref } from "./settings";

type MessageFile = Record<string, { message: string; description?: string }>;

const files = import.meta.glob<MessageFile>("../locales/*/*.json", { eager: true, import: "default" });

const catalogs: Record<string, Record<string, string>> = {};
for (const [path, content] of Object.entries(files)) {
  const lang = path.split("/").at(-2)!;
  const cat = (catalogs[lang] ??= {});
  for (const [key, v] of Object.entries(content)) cat[key] = v.message;
}

export function isSupportedLang(l: string): l is Lang {
  return (SUPPORTED_LANGS as readonly string[]).includes(l);
}

/** Browser UI language reduced to its primary subtag, if supported; else `en`. */
export function browserLang(): Lang {
  let ui = "en";
  try { ui = chrome.i18n.getUILanguage(); } catch { ui = globalThis.navigator?.language ?? "en"; }
  const primary = ui.toLowerCase().split(/[-_]/)[0] ?? "en";
  return isSupportedLang(primary) ? primary : "en";
}

export function resolveLang(pref: LanguagePref): Lang {
  return pref === "auto" ? browserLang() : pref;
}

export interface Translator {
  lang: Lang;
  /** Translate `key` with positional substitutions. Never returns raw API values. */
  t(key: string, ...subs: (string | number)[]): string;
  /** True if the key exists in the chosen language or English. */
  has(key: string): boolean;
  /**
   * Label for an API enum value, e.g. enumLabel("veracity", "false") → key
   * `veracity_false`; unknown values fall back to `${prefix}_unknown`.
   */
  enumLabel(prefix: string, value: string): string;
  /** Translated error message for a TWR-… code (key `error_TWR_ING_002`), else generic. */
  errorLabel(code: string): string;
  /** Plural message: picks `${base}_${pluralCategory}` (e.g. `_one`, `_other`), `$1` = n. */
  tp(base: string, n: number, ...subs: (string | number)[]): string;
  plural(n: number): Intl.LDMLPluralRule;
  number(n: number): string;
  date(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string;
}

function substitute(msg: string, subs: (string | number)[], fmt: (n: number) => string): string {
  return msg.replace(/\$(\d)/g, (_m, d: string) => {
    const v = subs[Number(d) - 1];
    return v === undefined ? "" : typeof v === "number" ? fmt(v) : v;
  });
}

export function createTranslator(pref: LanguagePref | Lang = "auto"): Translator {
  const lang = pref === "auto" ? browserLang() : pref;
  const primary = catalogs[lang] ?? {};
  const fallback = catalogs.en ?? {};
  const nf = new Intl.NumberFormat(lang);
  const pr = new Intl.PluralRules(lang);
  const lookup = (key: string): string | undefined => {
    const m = primary[key] ?? fallback[key];
    if (m !== undefined) return m;
    try {
      const c = chrome.i18n.getMessage(key);
      if (c) return c;
    } catch { /* not in an extension context (tests) */ }
    return undefined;
  };
  const tr: Translator = {
    lang,
    t: (key, ...subs) => {
      const m = lookup(key) ?? lookup("generic_unknown") ?? "…";
      return substitute(m, subs, (n) => nf.format(n));
    },
    has: (key) => key in primary || key in fallback,
    enumLabel: (prefix, value) => {
      const key = `${prefix}_${value.replace(/[^A-Za-z0-9]/g, "_")}`;
      return tr.has(key) ? tr.t(key) : tr.t(`${prefix}_unknown`);
    },
    errorLabel: (code) => {
      const key = `error_${code.replace(/-/g, "_")}`;
      return tr.has(key) ? tr.t(key) : tr.t("error_generic");
    },
    tp: (base, n, ...subs) => {
      const cat = pr.select(n);
      const key = tr.has(`${base}_${cat}`) ? `${base}_${cat}` : `${base}_other`;
      return tr.t(key, n, ...subs);
    },
    plural: (n) => pr.select(n),
    number: (n) => nf.format(n),
    date: (iso, opts = { dateStyle: "medium" }) => new Intl.DateTimeFormat(lang, opts).format(new Date(iso)),
  };
  return tr;
}

/** Exposed for the locale consistency test and the build. */
export const __catalogs = catalogs;
