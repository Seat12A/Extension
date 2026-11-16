import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { PRIVACY_URL, SITE_URL } from "~/shared/config";
import { KNOWN_BADGE_CATEGORIES } from "~/shared/palette";
import { CategoryBadge } from "./category";
import { SectionHeader } from "./shared";

export function AboutSection() {
  const { t, enumLabel } = useT();
  const version = chrome.runtime.getManifest?.().version ?? "";
  return (
    <div className="space-y-6">
      <SectionHeader title={t("options_about_title")} />
      <p className="text-[15px] leading-6 text-ink-slate">{t("options_about_text")}</p>

      <section className="space-y-3" aria-labelledby="badges-title">
        <h3 id="badges-title" className="text-[15px] font-semibold text-foreground">{t("options_badges_title")}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {KNOWN_BADGE_CATEGORIES.map((c) => (
            <li key={c} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[15px] text-ink-slate">
              <CategoryBadge category={c} className="size-5" />
              {enumLabel("badge_category", c)}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button asChild variant="outline">
          <a href={SITE_URL} target="_blank" rel="noreferrer"><Icons.openInNew className="size-[18px]" />{t("options_about_site")}</a>
        </Button>
        <Button asChild variant="ghost">
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t("options_about_privacy")}</a>
        </Button>
        <p className="ml-auto text-[13px] text-muted-foreground tabular-nums">{t("options_about_version", version)}</p>
      </div>
    </div>
  );
}
