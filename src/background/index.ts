/** MV3 service worker entry. All listeners are registered synchronously at top level. */
import { ALARMS } from "~/shared/constants";
import { ensureCategoriesAlarm, refreshCategories } from "./badges";
import { ensureConfigAlarm, refreshConfig } from "./config";
import { ensureFlushAlarm, flush } from "./queue";
import { handle } from "./router";
import { getToken } from "./token";

// The content script keeps its handle → id table in storage.session. That area is
// closed to content scripts by default: without this, every read/write there fails
// silently and the table is lost at each page load (badges come and go).
try {
  void chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })?.catch?.(() => {});
} catch { /* older browser: memory-only table */ }

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
