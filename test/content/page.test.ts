import { describe, expect, it } from "vitest";
import { pageKind } from "~/content/page";

describe("pageKind", () => {
  it.each([
    ["/home", "home"], ["/search", "search"], ["/elonmusk", "profile"], ["/elonmusk/with_replies", "profile"],
    ["/elonmusk/media", "profile"], ["/elonmusk/status/123456", "status"], ["/Some_User/status/1/photo/1", "status"],
  ])("%s → %s", (path, kind) => expect(pageKind(path, "me")).toBe(kind));

  it.each([
    "/", "/messages", "/messages/123", "/notifications", "/settings/account", "/compose/post", "/i/bookmarks",
    "/i/flow/login", "/bookmarks", "/lists", "/explore", "/communities", "/jobs", "/premium", "/someone/followers",
    "/someone/status/abc", "/home/extra", "/bad-handle", "/waytoolonghandle_1234",
  ])("rejects %s", (path) => expect(pageKind(path, "me")).toBeNull());

  it("rejects the own profile (case-insensitive) but keeps others", () => {
    expect(pageKind("/Me", "me")).toBeNull();
    expect(pageKind("/me/with_replies", "ME")).toBeNull();
    expect(pageKind("/me/status/1", "me")).toBeNull();
    expect(pageKind("/me", null)).toBe("profile");
  });
});
