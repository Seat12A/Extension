import type { BadgeReportBody, BadgeRequestBody } from "~/shared/api-types";
import type { SubmitResult } from "~/shared/messages";
import { errorCode, gateFetch } from "./api";

function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean).filter((x) => x !== undefined && x !== "");
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      const c = clean(val);
      if (c !== undefined && c !== "") o[k] = c;
    }
    return o;
  }
  return v;
}

async function submit(path: string, body: unknown): Promise<SubmitResult> {
  const res = await gateFetch(path, { method: "POST", body: clean(body) });
  if (res.status === 201) return { ok: true };
  return { ok: false, code: errorCode(res.body) ?? (res.status === 0 ? "network" : "generic") };
}

export const submitBadgeRequest = (body: BadgeRequestBody) => submit("/v1/badges/requests", body);
export const submitBadgeReport = (body: BadgeReportBody) => submit("/v1/badges/reports", body);
