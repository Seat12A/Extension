import { describe, expect, it } from "vitest";
import { parseHash } from "@/lib/hash";

describe("parseHash", () => {
  it("defaults to general", () => {
    expect(parseHash("")).toEqual({ tab: "general", params: {} });
    expect(parseHash("#nope")).toEqual({ tab: "general", params: {} });
  });
  it("reads the tab", () => {
    expect(parseHash("#privacy").tab).toBe("privacy");
    expect(parseHash("about").tab).toBe("about");
  });
  it("reads params", () => {
    expect(parseHash("#request?account=123456")).toEqual({ tab: "request", params: { account: "123456" } });
    expect(parseHash("#report?account=42&x=a%20b")).toEqual({ tab: "report", params: { account: "42", x: "a b" } });
  });
});
