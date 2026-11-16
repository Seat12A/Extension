import { describe, expect, it } from "vitest";
import { parseCompactNumber as p } from "~/content/numbers";

describe("parseCompactNumber", () => {
  it.each([
    ["1,2 k", 1200], ["1.2K", 1200], ["12 k", 12000], ["3,4 M", 3_400_000], ["1 234", 1234],
    ["1,234", 1234], ["987", 987], ["1 M", 1_000_000], ["2,5 Md", 2_500_000_000], ["1.5B", 1_500_000_000],
    ["1 234", 1234], ["1 234", 1234], ["1,2 k", 1200], ["3.4 M", 3_400_000], ["0", 0],
  ])("%s → %d", (input, expected) => expect(p(input)).toBe(expected));

  it.each([[""], ["   "], ["abc"], ["k"], ["12 xyz"], [undefined], [null]])("%s → undefined", (v) => expect(p(v as string)).toBeUndefined());
});
