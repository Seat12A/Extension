import { Icons } from "@/components/icons";
import { LanguageSelect } from "@/components/language-select";
import { SettingSwitch } from "@/components/setting-switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useT } from "@/i18n";
import { useSettings } from "@/use-settings";
import type { ThemePref } from "~/shared/settings";
import { SectionHeader } from "./shared";

const THEMES: { value: ThemePref; icon: keyof typeof Icons; key: string }[] = [
  { value: "system", icon: "contrast", key: "options_theme_system" },
  { value: "light", icon: "lightMode", key: "options_theme_light" },
  { value: "dark", icon: "darkMode", key: "options_theme_dark" },
];

export function GeneralSection() {
  const { t } = useT();
  const [settings, update] = useSettings();
  if (!settings) return null;
  return (
    <div className="space-y-6">
      <SectionHeader title={t("options_general_title")} description={t("options_general_desc")} />

      <div className="space-y-1.5">
        <LanguageSelect label={t("options_language")} value={settings.language} onChange={(language) => void update({ language })} />
        <p className="text-[13px] text-muted-foreground">{t("options_language_help")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[15px] font-medium text-foreground">{t("options_theme")}</legend>
        <RadioGroup value={settings.theme} onValueChange={(theme) => void update({ theme: theme as ThemePref })} className="grid-cols-3 gap-2" aria-label={t("options_theme")}>
          {THEMES.map(({ value, icon, key }) => {
            const Icon = Icons[icon];
            const id = `theme-${value}`;
            return (
              <Label key={value} htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-[15px] font-medium has-[[data-state=checked]]:border-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                <RadioGroupItem id={id} value={value} className="sr-only" />
                <Icon className="size-5 text-muted-foreground" />
                {t(key)}
              </Label>
            );
          })}
        </RadioGroup>
      </fieldset>

      <section className="space-y-4 border-t pt-6" aria-labelledby="features-title">
        <h3 id="features-title" className="text-[15px] font-semibold text-foreground">{t("options_features")}</h3>
        <SettingSwitch label={t("options_send_observations")} helper={t("options_send_observations_help")} checked={settings.sendObservations} onCheckedChange={(v) => void update({ sendObservations: v })} />
        <SettingSwitch label={t("options_show_verdicts")} helper={t("options_show_verdicts_help")} checked={settings.showVerdicts} onCheckedChange={(v) => void update({ showVerdicts: v })} />
        <SettingSwitch label={t("options_show_badges")} helper={t("options_show_badges_help")} checked={settings.showBadges} onCheckedChange={(v) => void update({ showBadges: v })} />
      </section>
    </div>
  );
}
