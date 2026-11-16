/**
 * Parses the compact counters X displays ("1,2 k", "1.2K", "3,4 M", "1 234", "2,5 Md").
 * With a suffix, `,` or `.` is the decimal separator. Without a suffix every
 * separator (space, NBSP, narrow NBSP, `,` or `.`) is a thousands separator.
 */
const MULT: Record<string, number> = { k: 1e3, m: 1e6, md: 1e9, mrd: 1e9, b: 1e9, g: 1e9 };

export function parseCompactNumber(input: string | null | undefined): number | undefined {
  if (!input) return undefined;
  const s = input.replace(/[\s   ]+/g, " ").trim();
  const m = /^(\d[\d .,]*?)\s?(mrd|md|k|m|b|g)?$/i.exec(s);
  if (!m) return undefined;
  const digits = m[1]!;
  const suffix = m[2]?.toLowerCase();
  if (suffix) {
    const n = Number.parseFloat(digits.replace(/ /g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * MULT[suffix]!) : undefined;
  }
  const n = Number.parseInt(digits.replace(/[ .,]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}
