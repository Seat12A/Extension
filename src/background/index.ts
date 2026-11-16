/** MV3 service worker entry. All listeners are registered synchronously at top level. */
import { ALARMS } from "~/shared/constants";
import { ensureCategoriesAlarm, refreshCategories } from "./badges";
import { ensureConfigAlarm, refreshConfig } from "./config";
import { ensureFlushAlarm, flush } from "./queue";
import { handle } from "./router";
import { getToken } from "./token";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender?.id !== chrome.runtime.id) return false;
  const type = (msg as { type?: unknown } | null)?.type;
  const run = typeof type === "string" ? handle(msg) : Promise.reject(new Error("unknown_request"));
  run.then(sendResponse, (e: unknown) => sendResponse({ __error: String((e as Error)?.message ?? e) }));
  return true;
});

async function ensureAlarms(): Promise<void> {
  await Promise.all([ensureConfigAlarm(), ensureFlushAlarm(), ensureCategoriesAlarm()]);
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") await getToken();
    await ensureAlarms();
    await Promise.all([refreshConfig(), refreshCategories()]);
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarms();
  void refreshConfig();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case ALARMS.config: void refreshConfig(); break;
    case ALARMS.flush: void flush(); break;
    case ALARMS.categories: void refreshCategories(); break;
  }
});

void ensureAlarms();
