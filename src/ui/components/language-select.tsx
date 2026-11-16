import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";
import { useT } from "@/i18n";
import type { LanguagePref } from "~/shared/settings";

const OPTIONS: LanguagePref[] = ["auto", "fr", "en"];

/** Language picker; each language is shown in its own language (the label of "auto" follows the UI). */
export function LanguageSelect({ value, onChange, label }: { value: LanguagePref; onChange: (v: LanguagePref) => void; label: string }) {
  const { t } = useT();
  const id = useId();
  const own = (l: LanguagePref) => (l === "auto" ? t("language_auto") : t(`language_${l}`));
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="flex items-center gap-2 text-[15px] font-medium text-foreground">
        <Icons.language className="size-5 text-muted-foreground" />
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as LanguagePref)}>
        <SelectTrigger id={id} className="w-[216px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((l) => <SelectItem key={l} value={l}>{own(l)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
