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
  it("ties the id to the handle written on the button, never to the URL", () => {
    load("profile-header.html");
    learnAuthorIds(document, "/someone_else");
    expect(getAuthorId("someone_else")).toBeUndefined();
    expect(getAuthorId("kate_prof")).toBe("987654321");
  });
  it("is not fooled by a stale follow button during a profile → profile navigation", () => {
    // URL and header already show @seat12a, X has not swapped the button yet.
    document.body.innerHTML = `
      <button aria-label="Suivre @EmmanuelMacron" data-testid="1976143068-follow"></button>
      <div data-testid="UserName"><span>Seat 12A</span><span>@seat12a</span></div>`;
    learnAuthorIds(document, "/seat12a");
    expect(getAuthorId("seat12a")).toBeUndefined();
    expect(getAuthorId("EmmanuelMacron")).toBe("1976143068");
  });
  it("learns from a follow button inside a post (focal post of a status page)", () => {
    document.body.innerHTML = `<article data-testid="tweet"><button aria-label="Follow @focal_author" data-testid="31337-follow"></button></article>`;
    learnAuthorIds(document, "/focal_author/status/1");
    expect(getAuthorId("focal_author")).toBe("31337");
  });
  it("learns from the profile page JSON-LD (own profile, logged out)", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@context": "http://schema.org", "@type": "ProfilePage",
      mainEntity: { "@type": "Person", additionalName: "seat12a", identifier: "1234567890", givenName: "Seat 12A" },
    })}</script><script type="application/ld+json">not json</script>`;
    learnAuthorIds(document, "/seat12a");
    expect(getAuthorId("seat12a")).toBe("1234567890");
    document.head.innerHTML = "";
  });
  it("forgets the old handle of a renamed account", () => {
    document.body.innerHTML = `<button aria-label="Suivre @old_name" data-testid="42-follow"></button>`;
    learnAuthorIds(document);
    document.body.innerHTML = `<button aria-label="Suivre @new_name" data-testid="42-follow"></button>`;
    learnAuthorIds(document);
    expect(getAuthorId("new_name")).toBe("42");
    expect(getAuthorId("old_name")).toBeUndefined();
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
