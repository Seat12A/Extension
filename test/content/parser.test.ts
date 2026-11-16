import { describe, expect, it } from "vitest";
import { parsePost } from "~/content/parser";
import { articles, load } from "./helpers";

const parse = (i = 0, path = "/home", own: string | null = null) => parsePost(articles()[i]!, { pathname: path }, own);

describe("parsePost", () => {
  it("parses every field of a simple post", () => {
    load("post-simple.html");
    const p = parse()!;
    expect(p.externalId).toBe("1850000000000000001");
    expect(p.handle).toBe("alice_fr");
    expect(p.text).toBe("Le gouvernement annonce une baisse des impôts de 10 % dès janvier. Source : discours de ce matin 🇫🇷");
    expect(p.langHint).toBe("fr");
    expect(p.createdAt).toBe("2026-11-15T09:30:00.000Z");
    expect(p.metrics).toEqual({ replies: 12, reposts: 1200, likes: 3400, views: 125000 });
    expect(p.media).toEqual([]);
    expect(p.quotedExternalId).toBeUndefined();
    expect(p.parentExternalId).toBeUndefined();
    expect(p.authorHasVerifiedIcon).toBe(false);
    expect(p.nodes.textEl?.getAttribute("data-testid")).toBe("tweetText");
    expect(p.nodes.actionGroup?.getAttribute("role")).toBe("group");
  });

  it("excludes the quoted post from text and media and reads its id", () => {
    load("post-quote.html");
    const p = parse()!;
    expect(p.text).toBe("Incroyable, regardez ça\net dites-moi ce que vous en pensez");
    expect(p.text).not.toContain("cité");
    expect(p.quotedExternalId).toBe("1849999999999999999");
    expect(p.media).toEqual([]);
    expect(p.handle).toBe("carol");
    expect(p.metrics).toEqual({ replies: 3, reposts: 5, likes: 42, views: 1200 });
  });

  it("omits quoted id when the quote has no status link", () => {
    load("post-quote.html");
    const q = document.querySelector('[role="link"] a[href*="/status/1849"]')!;
    q.replaceWith(...Array.from(q.childNodes));
    expect(parse()!.quotedExternalId).toBeUndefined();
  });

  it("reads images (max 4, https) and video posters; ignores lang und", () => {
    load("post-media.html");
    const a = parse(0)!;
    expect(a.media).toHaveLength(4);
    expect(a.media.every((m) => m.kind === "image" && m.url.startsWith("https://"))).toBe(true);
    expect(a.langHint).toBeUndefined();
    const v = parse(1)!;
    expect(v.text).toBe("");
    expect(v.media).toEqual([{ kind: "video", url: "https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/poster.jpg" }]);
    expect(v.metrics).toEqual({ views: 2_000_000 });
  });

  it("drops non-https media", () => {
    load("post-media.html");
    document.querySelectorAll("img[src*='media/A']").forEach((i) => i.setAttribute("src", "http://x/y.jpg"));
    expect(parse(0)!.media).toEqual([]);
    expect(parse(0)!.text).toBe("Quatre photos de la manifestation");
  });

  it("keeps a long text whole", () => {
    load("post-long.html");
    const p = parse()!;
    expect(p.text.length).toBeGreaterThan(1500);
    expect(p.text).toContain("Paragraphe 8");
    expect(p.text).toContain("\n\n");
  });

  it("returns null for ads, protected accounts, own posts and posts without status link", () => {
    load("post-ad.html");
    expect(parse()).toBeNull();
    load("post-protected.html");
    expect(parse()).toBeNull();
    load("post-own.html");
    expect(parse(0, "/home", "SELF_USER")).toBeNull();
    expect(parse(0, "/home", null)).not.toBeNull();
    load("post-simple.html");
    document.querySelector("time")!.closest("a")!.setAttribute("href", "/alice_fr");
    expect(parse()).toBeNull();
  });

  it("returns null for a post with neither text nor media", () => {
    load("post-simple.html");
    document.querySelector('[data-testid="tweetText"]')!.remove();
    expect(parse()).toBeNull();
  });

  it("skips aria-hidden text and keeps hidden-by-CSS link prefixes", () => {
    load("post-simple.html");
    const t = document.querySelector('[data-testid="tweetText"]')!;
    t.innerHTML = '<span>Voir </span><a href="/x"><span aria-hidden="true">…</span><span style="display:none">https://</span><span>t.co/abc</span></a>';
    expect(parse()!.text).toBe("Voir https://t.co/abc");
  });

  it("detects verified icons and their colour", () => {
    load("post-verified-grey.html", "post-verified-blue.html");
    expect(parse(0)!.authorHasVerifiedIcon).toBe(true);
    expect(parse(0)!.verifiedColor).toBe("rgb(130, 154, 171)");
    expect(parse(1)!.verifiedColor).toBe("rgb(29, 155, 240)");
  });

  it("sets the parent on a status page for the focused post only", () => {
    load("status-page.html");
    const path = "/ivan/status/1850000000000000010";
    expect(parse(0, path)!.parentExternalId).toBeUndefined();
    expect(parse(1, path)!.parentExternalId).toBe("1850000000000000001");
    expect(parse(2, path)!.parentExternalId).toBeUndefined();
    expect(parse(1, "/home")!.parentExternalId).toBeUndefined();
  });
});
