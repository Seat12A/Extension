import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { SubmitResult } from "~/shared/messages";

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h2 className="text-xl leading-7 font-semibold tracking-[-0.5px] text-foreground">{title}</h2>
      {description ? <p className="text-[15px] leading-5 text-ink-slate">{description}</p> : null}
    </header>
  );
}

/** Label + control + helper + inline error, wired with htmlFor / aria-describedby / aria-invalid. */
export function Field({ id, label, help, error, children }: {
  id: string; label: string; help?: string; error?: string | null;
  children: (a: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const helpId = `${id}-help`;
  const errId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {help ? <p id={helpId} className="text-[13px] leading-[18px] text-muted-foreground">{help}</p> : null}
      {error ? <p id={errId} className="text-[13px] leading-[18px] text-destructive">{error}</p> : null}
    </div>
  );
}

export function Group({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="mb-1.5 text-[13px] font-medium text-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

export type SubmitState = { status: "idle" } | { status: "sending" } | { status: "ok" } | { status: "error"; code: string };

const COOLDOWN_MS = 60_000;

/** Runs a submission and tracks its outcome. After TWR-BDG-019 submitting is blocked for 60 s (no retry). */
export function useSubmit(run: () => Promise<SubmitResult>) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [blocked, setBlocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const submit = useCallback(async () => {
    setState({ status: "sending" });
    try {
      const res = await run();
      if (res.ok) { setState({ status: "ok" }); return true; }
      setState({ status: "error", code: res.code });
      if (res.code === "TWR-BDG-019") {
        setBlocked(true);
        timer.current = setTimeout(() => setBlocked(false), COOLDOWN_MS);
      }
    } catch {
      setState({ status: "error", code: "network" });
    }
    return false;
  }, [run]);
  return { state, submit, blocked, sending: state.status === "sending", reset: () => setState({ status: "idle" }) };
}

export function ResultAlert({ state, successMessage }: { state: SubmitState; successMessage: string }) {
  const { t, errorLabel } = useT();
  return (
    <div aria-live="polite">
      {state.status === "ok" ? (
        <Alert>
          <Icons.checkCircle className="text-success" />
          <AlertTitle>{t("options_success_title")}</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive">
          <Icons.error />
          <AlertTitle>{t("options_error_title")}</AlertTitle>
          <AlertDescription>{state.code === "network" ? t("error_network") : errorLabel(state.code)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
