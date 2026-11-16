import type { Request, ResponseMap } from "~/shared/messages";
import { getAccountDetail, getBadgeCategories, lookupBadges, sendGovernmentHints } from "./badges";
import { getConfig } from "./config";
import { submitBadgeReport, submitBadgeRequest } from "./forms";
import { enqueue } from "./queue";
import { getStatus } from "./status";
import { resetToken } from "./token";
import { getVerdicts } from "./verdicts";

const HASH_RE = /^[\w\-=&?/]*$/;

export async function handle<R extends Request>(msg: R): Promise<ResponseMap[R["type"]]>;
export async function handle(msg: Request): Promise<ResponseMap[Request["type"]]> {
  switch (msg.type) {
    case "observe": return enqueue(msg.items);
    case "getConfig": return getConfig();
    case "getVerdicts": return getVerdicts(msg.ids, msg.lang);
    case "lookupBadges": return lookupBadges(msg.ids);
    case "getBadgeCategories": return getBadgeCategories();
    case "getAccountDetail": return getAccountDetail(msg.id);
    case "governmentHints": return sendGovernmentHints(msg.ids);
    case "submitBadgeRequest": return submitBadgeRequest(msg.body);
    case "submitBadgeReport": return submitBadgeReport(msg.body);
    case "getStatus": return getStatus();
    case "resetToken": await resetToken(); return { ok: true };
    case "openOptions": {
      const hash = typeof msg.hash === "string" && msg.hash && HASH_RE.test(msg.hash) ? "#" + msg.hash : "";
      await chrome.tabs.create({ url: chrome.runtime.getURL("options.html" + hash) });
      return { ok: true };
    }
    default: {
      const _never: never = msg;
      void _never;
      throw new Error("unknown_request");
    }
  }
}
