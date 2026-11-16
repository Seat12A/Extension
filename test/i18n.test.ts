import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator, __catalogs } from "~/shared/i18n";
import { SUPPORTED_LANGS } from "~/shared/constants";

const localesDir = path.resolve(__dirname, "../src/locales");

describe("locales", () => {
  it("every supported language has a folder", () => {
    expect(readdirSync(localesDir).sort()).toEqual([...SUPPORTED_LANGS].sort());
  });

  it("all languages have exactly the same keys, file by file", () => {
    const files = (lang: string) => readdirSync(path.join(localesDir, lang)).sort();
    const ref = files("fr");
    for (const lang of SUPPORTED_LANGS) {
      expect(files(lang)).toEqual(ref);
      for (const f of ref) {
        const a = Object.keys(JSON.parse(readFileSync(path.join(localesDir, "fr", f), "utf8"))).sort();
        const b = Object.keys(JSON.parse(readFileSync(path.join(localesDir, lang, f), "utf8"))).sort();
        expect(b, `${lang}/${f}`).toEqual(a);
      }
    }
  });

  it("keys are valid Chrome message names and messages are non-empty", () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const [k, v] of Object.entries(__catalogs[lang]!)) {
        expect(k).toMatch(/^[A-Za-z0-9_@]+$/);
        expect(v.trim().length, `${lang}:${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("substitution counts match across languages", () => {
    const count = (m: string) => [...new Set(m.match(/\$\d/g) ?? [])].sort().join();
    for (const [k, v] of Object.entries(__catalogs.fr!)) expect(count(__catalogs.en![k]!), k).toBe(count(v));
  });
});

describe("translator", () => {
  it("translates enum values and falls back to a generic label", () => {
    const fr = createTranslator("fr");
    expect(fr.enumLabel("veracity", "false")).toBe("Faux");
    expect(fr.enumLabel("veracity", "brand_new_value")).toBe("Vérifié");
    expect(fr.errorLabel("TWR-BDG-019")).toMatch(/minute/);
    expect(fr.errorLabel("TWR-XXX-999")).toBe(fr.t("error_generic"));
  });
  it("resolves auto to the browser language", () => {
    expect(createTranslator("auto").lang).toBe("fr");
  });
});

describe("no hard-coded visible strings", () => {
  // Heuristic: JSX text nodes and user-facing attributes must not contain letters.
  const exts = /\.(tsx?|html)$/;
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : exts.test(e.name) ? [path.join(d, e.name)] : []);
  const files = ["content", "popup", "options", "pages"].flatMap((d) => {
    try { return walk(path.resolve(__dirname, "../src", d)); } catch { return []; }
  });
  it.each(files)("%s", (file) => {
    const src = readFileSync(file, "utf8");
    const offenders: string[] = [];
    const attr = /(aria-label|title|alt|placeholder)=["']([^"'{}]*[A-Za-zÀ-ÿ][^"'{}]*)["']/g;
    for (const m of src.matchAll(attr)) offenders.push(m[0]);
    if (file.endsWith(".tsx")) {
      const jsxText = />\s*([A-Za-zÀ-ÿ][^<>{}]*?)\s*</g;
      for (const m of src.matchAll(jsxText)) if (!/^[\w.]+$/.test(m[1]!) || /\s/.test(m[1]!)) offenders.push(m[1]!);
    }
    if (/\.(ts|tsx)$/.test(file)) {
      const textProps = /\.(textContent|innerText|title|ariaLabel|placeholder)\s*=\s*["'`][^"'`]*[A-Za-zÀ-ÿ]/g;
      for (const m of src.matchAll(textProps)) offenders.push(m[0]);
      const setAttr = /setAttribute\(\s*["'](aria-label|title|alt|placeholder)["']\s*,\s*["'`][^"'`]*[A-Za-zÀ-ÿ]/g;
      for (const m of src.matchAll(setAttr)) offenders.push(m[0]);
    }
    expect(offenders).toEqual([]);
  });
});
