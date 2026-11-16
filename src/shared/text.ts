/**
 * Text normalisation aligned with Tower's E0 normalisation (core/domain/text.py):
 * NFKC, lowercase, collapsed whitespace.
 */
export function normalizeText(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/**
 * Keyword match: a single word must match as a whole word, an expression (contains a
 * space) matches as a substring. Both sides are normalised. `normText` must already
 * be normalised (normalise once per post, not per keyword).
 */
export function matchesKeyword(normText: string, keyword: string): boolean {
  const k = normalizeText(keyword);
  if (!k) return false;
  if (k.includes(" ")) return normText.includes(k);
  let from = 0;
  for (;;) {
    const i = normText.indexOf(k, from);
    if (i < 0) return false;
    const before = i > 0 ? normText[i - 1]! : "";
    const after = normText[i + k.length] ?? "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
    from = i + 1;
  }
}
