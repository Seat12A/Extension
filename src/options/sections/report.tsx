import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { send } from "~/shared/messages";
import type { BadgeAccountDetail, BadgeReportReason } from "~/shared/api-types";
import { CategoryBadge } from "./category";
import { ID_PATTERN } from "./request-logic";
import { Field, Group, ResultAlert, SectionHeader, useSubmit } from "./shared";

const REASONS: BadgeReportReason[] = ["wrong_category", "not_eligible", "impersonation", "wrong_affiliation", "other"];

function AccountCard({ id }: { id: string }) {
  const { t, enumLabel } = useT();
  const [detail, setDetail] = useState<BadgeAccountDetail | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    send({ type: "getAccountDetail", id })
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setDetail(null));
    return () => { alive = false; };
  }, [id]);

  if (detail === undefined) return <Skeleton className="h-[62px] w-full rounded-lg" aria-label={t("options_account_loading")} />;
  if (detail === null) return <p className="text-[13px] text-muted-foreground" aria-live="polite">{t("options_account_unknown")}</p>;
  const aff = detail.affiliation;
  const affText = aff ? [aff.title, aff.org.label].filter(Boolean).join(" · ") : "";
  return (
    <section aria-label={t("options_account_card")} className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <CategoryBadge category={detail.category} color={detail.color} className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="text-[15px] leading-5 font-semibold text-foreground">{enumLabel("badge_category", detail.category)}</p>
        <p className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {affText || (detail.badge ? t("options_account_own_badge") : t("options_account_org_badge"))}
        </p>
      </div>
    </section>
  );
}

export function ReportSection({ initialAccount = "" }: { initialAccount?: string }) {
  const { t, enumLabel } = useT();
  const uid = useId();
  const [accountId, setAccountId] = useState(initialAccount);
  const [reason, setReason] = useState<BadgeReportReason>("wrong_category");
  const [comment, setComment] = useState("");
  const [attempted, setAttempted] = useState(false);

  const idValid = ID_PATTERN.test(accountId.trim());
  const commentTooLong = comment.trim().length > 1000;
  const errors = attempted
    ? { account: idValid ? null : t("options_error_account"), comment: commentTooLong ? t("options_error_comment") : null }
    : { account: null, comment: null };

  const run = useCallback(() => send({
    type: "submitBadgeReport",
    body: { account: { platform: "x", external_id: accountId.trim() }, reason, ...(comment.trim() ? { comment: comment.trim() } : {}) },
  }), [accountId, reason, comment]);
  const { state, submit, blocked, sending } = useSubmit(run);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (idValid && !commentTooLong) await submit();
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
      <SectionHeader title={t("options_report_title")} description={t("options_report_desc")} />

      <Field id={`${uid}-account`} label={t("options_account_id")} help={t("options_account_id_help")} error={errors.account}>
        {(a) => <Input {...a} required inputMode="numeric" pattern="^\d{1,19}$" autoComplete="off" value={accountId} onChange={(e) => setAccountId(e.target.value)} />}
      </Field>

      {idValid ? <AccountCard id={accountId.trim()} /> : null}

      <Group legend={t("options_report_reason")}>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as BadgeReportReason)} className="gap-2.5">
          {REASONS.map((r) => (
            <div key={r} className="flex items-center gap-2.5">
              <RadioGroupItem id={`${uid}-reason-${r}`} value={r} />
              <Label htmlFor={`${uid}-reason-${r}`} className="text-[15px] font-normal text-ink-slate">{enumLabel("report_reason", r)}</Label>
            </div>
          ))}
        </RadioGroup>
      </Group>

      <Field id={`${uid}-comment`} label={t("options_report_comment")} error={errors.comment}>
        {(a) => <Textarea {...a} rows={4} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />}
      </Field>

      <ResultAlert state={state} successMessage={t("options_report_success")} />

      <Button type="submit" size="lg" disabled={sending || blocked}>
        {sending ? t("options_sending") : t("options_report_submit")}
      </Button>
    </form>
  );
}
