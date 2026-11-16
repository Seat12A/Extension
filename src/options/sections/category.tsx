import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { useResolvedTheme } from "@/theme";
import { send } from "~/shared/messages";
import { badgeColors, KNOWN_BADGE_CATEGORIES } from "~/shared/palette";
import type { BadgeCategory, BadgeCategoryInfo } from "~/shared/api-types";

/** Small coloured verified badge, in the category colour of the current theme. */
export function CategoryBadge({ category, color, className = "size-[18px]" }: { category: BadgeCategory; color?: string; className?: string }) {
  const theme = useResolvedTheme();
  const { fill } = badgeColors(category, theme === "dark" ? "dark" : "light", color);
  return <Icons.verifiedFill className={className} style={{ color: fill }} />;
}

/** Five known categories first, then whatever the server adds, ordered by rank. */
export function useBadgeCategories(): BadgeCategoryInfo[] {
  const [cats, setCats] = useState<BadgeCategoryInfo[]>(() =>
    KNOWN_BADGE_CATEGORIES.map((category, rank) => ({ category, color: "", rank })));
  useEffect(() => {
    let alive = true;
    send({ type: "getBadgeCategories" })
      .then((res) => { if (alive && Array.isArray(res) && res.length) setCats([...res].sort((a, b) => a.rank - b.rank)); })
      .catch(() => { /* keep the known categories */ });
    return () => { alive = false; };
  }, []);
  return cats;
}
