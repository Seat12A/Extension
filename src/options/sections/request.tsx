import { useCallback, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { send } from "~/shared/messages";
import { CategoryBadge, useBadgeCategories } from "./category";
import { buildRequestBody, validateRequest, type RequestErrors, type RequestValues } from "./request-logic";
import { Field, Group, ResultAlert, SectionHeader, useSubmit } from "./shared";

export function RequestSection({ initialAccount = "" }: { initialAccount?: string }) {
  const { t, enumLabel } = useT();
  const cats = useBadgeCategories();
  const uid = useId();
  const [values, setValues] = useState<RequestValues>({
    kind: "badge", accountId: initialAccount, category: "personality", orgId: "", orgTitle: "", justification: "", contact: "", evidence: "",
  });
  const [errors, setErrors] = useState<RequestErrors>({});
  const [attempted, setAttempted] = useState(false);

  const run = useCallback(() => send({ type: "submitBadgeRequest", body: buildRequestBody(values) }), [values]);
  const { state, submit, blocked, sending } = useSubmit(run);

  const set = <K extends keyof RequestValues>(k: K, v: RequestValues[K]) => {
    const next = { ...values, [k]: v };
    setValues(next);
    if (attempted) setErrors(validateRequest(next));
  };
  const err = (k: keyof RequestErrors) => (errors[k] ? t(errors[k]!) : null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const found = validateRequest(values);
    setErrors(found);
    if (Object.keys(found).length === 0) await submit();
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
      <SectionHeader title={t("options_request_title")} description={t("options_request_desc")} />

      <Group legend={t("options_request_kind")}>
        <RadioGroup value={values.kind} onValueChange={(v) => set("kind", v as RequestValues["kind"])} className="gap-2.5">
          {(["badge", "affiliation"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2.5">
              <RadioGroupItem id={`${uid}-kind-${k}`} value={k} />
              <Label htmlFor={`${uid}-kind-${k}`} className="text-[15px] font-normal text-ink-slate">{t(`options_request_kind_${k}`)}</Label>
            </div>
          ))}
        </RadioGroup>
      </Group>

      <Field id={`${uid}-account`} label={t("options_account_id")} help={t("options_account_id_help")} error={err("accountId")}>
        {(a) => <Input {...a} required inputMode="numeric" pattern="^\d{1,19}$" autoComplete="off" value={values.accountId} onChange={(e) => set("accountId", e.target.value)} />}
      </Field>

      <div key={values.kind} className="animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
      {values.kind === "badge" ? (
        <Field id={`${uid}-category`} label={t("options_category")}>
          {({ id }) => (
            <Select value={values.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.category} value={c.category}>
                    <CategoryBadge category={c.category} color={c.color} />
                    {enumLabel("badge_category", c.category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${uid}-org`} label={t("options_org_id")} error={err("orgId")}>
            {(a) => <Input {...a} required inputMode="numeric" pattern="^\d{1,19}$" autoComplete="off" value={values.orgId} onChange={(e) => set("orgId", e.target.value)} />}
          </Field>
          <Field id={`${uid}-title`} label={t("options_org_title")} error={err("orgTitle")}>
            {(a) => <Input {...a} required maxLength={200} placeholder={t("options_org_title_placeholder")} value={values.orgTitle} onChange={(e) => set("orgTitle", e.target.value)} />}
          </Field>
        </div>
      )}
      </div>

      <Field id={`${uid}-justification`} label={t("options_justification")} help={t("options_justification_help")} error={err("justification")}>
        {(a) => <Textarea {...a} required minLength={20} maxLength={2000} rows={5} value={values.justification} onChange={(e) => set("justification", e.target.value)} />}
      </Field>

      <Field id={`${uid}-contact`} label={t("options_contact")} help={t("options_contact_help")} error={err("contact")}>
        {(a) => <Input {...a} maxLength={200} autoComplete="off" value={values.contact} onChange={(e) => set("contact", e.target.value)} />}
      </Field>

      <Field id={`${uid}-evidence`} label={t("options_evidence")} help={t("options_evidence_help")} error={err("evidence")}>
        {(a) => <Textarea {...a} rows={3} autoComplete="off" spellCheck={false} value={values.evidence} onChange={(e) => set("evidence", e.target.value)} />}
      </Field>

      <ResultAlert state={state} successMessage={t("options_request_success")} />

      <Button type="submit" size="lg" disabled={sending || blocked}>
        {sending ? t("options_sending") : t("options_submit")}
      </Button>
    </form>
  );
}
