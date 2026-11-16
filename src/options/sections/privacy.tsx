import { useId, useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { send } from "~/shared/messages";
import { SectionHeader } from "./shared";

/** Example of what leaves the browser for one post. Keys are API field names (data, not prose). */
export function buildExamplePayload(text: string) {
  return {
    items: [
      {
        platform: "x",
        external_id: "1800000000000000000",
        author: { handle: "example_account" },
        text,
        metrics: { views: 1200, likes: 34, reposts: 5, replies: 2 },
        observed_at: "2026-01-01T12:00:00Z",
      },
    ],
  };
}

function Bullets({ title, keys, icon, tone }: { title: string; keys: string[]; icon: "check" | "block"; tone: string }) {
  const { t } = useT();
  const Icon = Icons[icon];
  return (
    <div className="space-y-2">
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {keys.map((k) => (
          <li key={k} className="flex items-start gap-2.5 text-[15px] leading-5 text-ink-slate">
            <Icon className={`mt-px size-5 shrink-0 ${tone}`} />
            <span>{t(k)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PrivacySection() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"ok" | "error" | null>(null);
  const exampleId = useId();
  const payload = useMemo(() => JSON.stringify(buildExamplePayload(t("options_privacy_example_text")), null, 2), [t]);

  const reset = async () => {
    setBusy(true);
    try {
      await send({ type: "resetToken" });
      setDone("ok");
    } catch {
      setDone("error");
    } finally {
      setBusy(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title={t("options_privacy_title")} description={t("options_privacy_desc")} />

      <Bullets title={t("options_privacy_sent_title")} icon="check" tone="text-success"
        keys={[1, 2, 3, 4, 5].map((n) => `options_privacy_sent_${n}`)} />
      <Bullets title={t("options_privacy_never_title")} icon="block" tone="text-destructive"
        keys={[1, 2, 3, 4, 5].map((n) => `options_privacy_never_${n}`)} />

      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-foreground">{t("options_privacy_lookups_title")}</h3>
        <p className="text-[15px] leading-5 text-ink-slate">{t("options_privacy_lookups_badges")}</p>
        <p className="text-[15px] leading-5 text-ink-slate">{t("options_privacy_lookups_verdicts")}</p>
      </div>

      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-3" aria-expanded={open} aria-controls={exampleId} onClick={() => setOpen((o) => !o)}>
          <Icons.code className="size-[18px] text-muted-foreground" />
          {open ? t("options_privacy_example_hide") : t("options_privacy_example_toggle")}
          {open ? <Icons.expandLess className="size-[18px]" /> : <Icons.expandMore className="size-[18px]" />}
        </Button>
        <div id={exampleId} hidden={!open}>
          <pre tabIndex={0} aria-label={t("options_privacy_example_label")} className="overflow-x-auto rounded-lg whitespace-pre-wrap break-words border bg-muted p-4 font-mono text-[13px] leading-5 text-ink-slate focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"><code>{payload}</code></pre>
        </div>
      </div>

      <section className="space-y-3 border-t pt-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <Icons.key className="size-5 text-muted-foreground" />
          {t("options_token_title")}
        </h3>
        <p className="text-[15px] leading-5 text-ink-slate">{t("options_token_desc")}</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Icons.refresh className="size-[18px]" />{t("options_token_reset")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("options_token_confirm_title")}</DialogTitle>
              <DialogDescription>{t("options_token_confirm_desc")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t("options_token_cancel")}</Button></DialogClose>
              <Button onClick={() => void reset()} disabled={busy}>{t("options_token_confirm")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div aria-live="polite">
          {done === "ok" ? (
            <Alert><Icons.checkCircle className="text-success" /><AlertDescription>{t("options_token_success")}</AlertDescription></Alert>
          ) : null}
          {done === "error" ? (
            <Alert variant="destructive"><Icons.error /><AlertDescription>{t("error_generic")}</AlertDescription></Alert>
          ) : null}
        </div>
      </section>
    </div>
  );
}
