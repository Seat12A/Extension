import type { ObservationItem } from "~/shared/api-types";
import type { ExtensionState, ExtensionStatus } from "~/shared/messages";
import { getSettings } from "~/shared/settings";
import { readStoredConfig } from "./config";
import { loadState, suspendedUntil, utcDate } from "./queue";
import { getLocal } from "./store";

export async function getStatus(): Promise<ExtensionStatus> {
  const [settings, cfg, st, queue] = await Promise.all([
    getSettings(), readStoredConfig(), loadState(), getLocal<ObservationItem[]>("queue", []),
  ]);
  const now = Date.now();
  let state: ExtensionState = "active";
  let resumeAt: string | null = null;
  const q = suspendedUntil(st, now);
  if (!settings.sendObservations) state = "paused";
  else if (q) { state = "quota"; resumeAt = new Date(q).toISOString(); }
  else if (!cfg || cfg.version == null) state = "no_filters";
  else if (st.backoffUntil > now) { state = "offline"; resumeAt = new Date(st.backoffUntil).toISOString(); }
  return {
    state,
    queueSize: queue.length,
    sentToday: st.sentDate === utcDate(now) ? st.sentToday : 0,
    resumeAt,
    filterVersion: cfg?.version ?? null,
    lastSyncAt: st.lastSyncAt,
  };
}
