import { describe, expect, it } from "vitest";
import { generateToken, getToken, resetToken } from "~/background/token";
import { getStatus } from "~/background/status";

describe("token", () => {
  it("is 43 chars base64url without padding", () => {
    for (let i = 0; i < 20; i++) expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("is stable, resettable and never in status", async () => {
    const a = await getToken();
    expect(await getToken()).toBe(a);
    const b = await resetToken();
    expect(b).not.toBe(a);
    expect(await getToken()).toBe(b);
    expect(JSON.stringify(await getStatus())).not.toContain(b);
  });
});
