import type { ReactNode } from "react";
import { Icons } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ExtensionStatus } from "~/shared/messages";

type Props = { status: ExtensionStatus | null; failed?: boolean };

/** Extension status: one icon, one title and one description line per state. */
export function StatusCard({ status, failed }: Props) {
  const { t, tp, date } = useT();
  let icon: ReactNode = null;
  let title = "";
  let desc = "";
  const iconCls = "size-6 shrink-0";
  if (status) {
    switch (status.state) {
      case "active":
        icon = <Icons.online className={cn(iconCls, "text-success")} />;
        title = t("popup_status_active");
        desc = tp("popup_sent_today", status.sentToday);
        if (status.queueSize > 0) desc = t("popup_sent_with_queue", desc, status.queueSize);
        break;
      case "paused":
        icon = <Icons.paused className={cn(iconCls, "text-muted-foreground")} />;
        title = t("popup_status_paused");
        desc = t("popup_status_paused_desc");
        break;
      case "quota":
        icon = <Icons.quota className={cn(iconCls, "text-muted-foreground")} />;
        title = t("popup_status_quota");
        desc = status.resumeAt ? t("popup_status_quota_desc", date(status.resumeAt, { timeStyle: "short" })) : t("popup_status_quota_desc_unknown");
        break;
      case "offline":
        icon = <Icons.offline className={cn(iconCls, "text-warning")} />;
        title = t("popup_status_offline");
        desc = status.resumeAt ? t("popup_status_offline_desc", date(status.resumeAt, { timeStyle: "short" })) : t("popup_status_offline_desc_unknown");
        break;
      case "no_filters":
        icon = <Icons.info className={cn(iconCls, "text-muted-foreground")} />;
        title = t("popup_status_no_filters");
        desc = t("popup_status_no_filters_desc");
        break;
    }
  } else if (failed) {
    icon = <Icons.offline className={cn(iconCls, "text-warning")} />;
    title = t("popup_status_error");
    desc = t("popup_status_error_desc");
  }

  return (
    <section aria-live="polite" aria-busy={!status && !failed} className="flex items-center gap-3 rounded-lg border bg-card p-4">
      {status || failed ? (
        <div key={status?.state ?? "failed"} className="flex min-w-0 items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out">
          {icon}
          <div className="min-w-0">
            <h2 className="text-[15px] leading-5 font-semibold text-foreground" data-testid="status-title">{title}</h2>
            <p className="text-[13px] leading-[18px] text-ink-slate" data-testid="status-desc">{desc}</p>
          </div>
        </div>
      ) : (
        <>
          <Skeleton className="size-6 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </>
      )}
    </section>
  );
}
