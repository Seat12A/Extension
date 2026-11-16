import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  helper?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

/** Settings row: label + 13px helper on the left, Switch on the right. */
export function SettingSwitch({ label, helper, checked, onCheckedChange }: Props) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-[15px] leading-5 font-medium text-foreground">{label}</Label>
        {helper ? <p id={helpId} className="text-[13px] leading-[18px] text-muted-foreground">{helper}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={helper ? helpId : undefined} className="mt-0.5" />
    </div>
  );
}
