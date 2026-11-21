import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { LogoMark, Wordmark } from "@/components/brand";
import { SettingSwitch } from "@/components/setting-switch";
import { LanguageSelect } from "@/components/language-select";
import { StatusCard } from "@/components/status-card";
import { useT } from "@/i18n";
import { useSettings } from "@/use-settings";
import { send, type ExtensionStatus } from "~/shared/messages";
import { PRIVACY_URL } from "~/shared/config";

const REFRESH_MS = 5000;

function useStatus() {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const s = await send({ type: "getStatus" });
        if (alive) { setStatus(s); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { status, failed };
}

type ReloadState = "idle" | "busy" | "done" | "error";

/** Clears every cache (worker + open x.com tabs) so fresh badges and verdicts show at once. */
function useReload() {
  const [state, setState] = useState<ReloadState>("idle");
  const run = useCallback(async () => {
    setState("busy");
    try {
      await send({ type: "clearCaches" });
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }, []);
  return { state, run };
}

export function App() {
  const { t } = useT();
  const [settings, update] = useSettings();
  const { status, failed } = useStatus();
  const reload = useReload();
  const openOptions = useCallback(() => { void chrome.runtime.openOptionsPage(); }, []);
  const version = chrome.runtime.getManifest?.().version ?? "";

  return (
    <main className="flex w-[360px] flex-col gap-4 bg-background p-4 animate-in fade-in-0 duration-200 ease-out">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-foreground">
          <LogoMark className="h-7" />
          <Wordmark className="h-[18px] w-auto" />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void reload.run()}
            disabled={reload.state === "busy"}
            aria-label={t("popup_reload")}
            title={t("popup_reload")}
            data-testid="reload"
          >
            {reload.state === "done" ? (
              <Icons.check className="size-5 text-muted-foreground" />
            ) : (
              <Icons.refresh className={`size-5 text-muted-foreground${reload.state === "busy" ? " animate-spin" : ""}`} />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={openOptions} aria-label={t("popup_open_options")} title={t("popup_open_options")}>
            <Icons.settings className="size-5 text-muted-foreground" />
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {reload.state === "done" ? t("popup_reload_done") : reload.state === "error" ? t("popup_reload_error") : ""}
          </span>
        </div>
      </header>

      <StatusCard status={status} failed={failed} />

      {settings ? (
        <div className="flex flex-col gap-4">
          <SettingSwitch label={t("popup_send_observations")} helper={t("popup_send_observations_help")} checked={settings.sendObservations} onCheckedChange={(v) => void update({ sendObservations: v })} />
          <SettingSwitch label={t("popup_show_verdicts")} helper={t("popup_show_verdicts_help")} checked={settings.showVerdicts} onCheckedChange={(v) => void update({ showVerdicts: v })} />
          <SettingSwitch label={t("popup_show_badges")} helper={t("popup_show_badges_help")} checked={settings.showBadges} onCheckedChange={(v) => void update({ showBadges: v })} />
          <div className="border-t pt-4">
            <LanguageSelect label={t("popup_language")} value={settings.language} onChange={(language) => void update({ language })} />
          </div>
        </div>
      ) : (
        <div className="h-[238px]" aria-hidden="true" />
      )}

      <footer className="flex items-center gap-2 border-t pt-3 text-[13px] text-muted-foreground">
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="rounded-sm hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">{t("popup_privacy")}</a>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={openOptions} className="rounded-sm hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">{t("popup_options")}</button>
        <span className="ml-auto tabular-nums">{t("popup_version", version)}</span>
      </footer>
    </main>
  );
}
