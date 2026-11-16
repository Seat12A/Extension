import { beforeEach, describe, expect, it, vi } from "vitest";
import { chromeMock } from "../chrome-mock";
import { getAuthorId, learnAuthorIds, loadAuthorIds, resetAuthorIds, onAuthorIdLearned } from "~/content/author-ids";
import { load } from "./helpers";

beforeEach(() => { resetAuthorIds(); document.body.innerHTML = ""; });

describe("author ids", () => {
  it("learns from the profile header (handle from URL)", () => {
    load("profile-header.html");
    learnAuthorIds(document, "/kate_prof");
    expect(getAuthorId("kate_prof")).toBe("987654321");
    expect(getAuthorId("KATE_PROF")).toBe("987654321");
  });
  it("ignores the header button when the URL does not match the displayed handle", () => {
    load("profile-header.html");
    learnAuthorIds(document, "/someone_else");
    expect(getAuthorId("someone_else")).toBeUndefined();
  });
  it("learns from user cells", () => {
    load("user-cell.html");
    const seen: string[] = [];
    onAuthorIdLearned((h, id) => seen.push(`${h}:${id}`));
    learnAuthorIds(document, "/search");
    expect(getAuthorId("leo_cell")).toBe("111222333");
    expect(getAuthorId("mia_cell")).toBe("444555666");
    expect(seen).toEqual(["leo_cell:111222333", "mia_cell:444555666"]);
  });
  it("persists to session storage (debounced) and reloads", async () => {
    vi.useFakeTimers();
    load("user-cell.html");
    learnAuthorIds(document, "/search");
    expect(chromeMock.storage.session.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(chromeMock.storage.session.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.session._dump().authorIds).toEqual({ leo_cell: "111222333", mia_cell: "444555666" });
    resetAuthorIds();
    expect(getAuthorId("leo_cell")).toBeUndefined();
    await loadAuthorIds();
    expect(getAuthorId("leo_cell")).toBe("111222333");
    vi.useRealTimers();
  });
});
