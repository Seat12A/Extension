/** The single network wrapper. Nothing else in the worker calls fetch. */
import { GATE_URL } from "~/shared/config";

export interface GateResponse {
  /** 0 on network failure. */
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export interface GateInit { method?: string; headers?: Record<string, string>; body?: unknown }

export async function gateFetch(path: string, init: GateInit = {}): Promise<GateResponse> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body !== undefined && !("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(GATE_URL + path, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "omit",
      signal: AbortSignal.timeout(15000),
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, headers: res.headers, body };
  } catch {
    return { status: 0, headers: new Headers(), body: null };
  }
}

/** Decide on `error.code` only, never on `message`. */
export function errorCode(body: unknown): string | null {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" ? code : null;
}

export const VALID_ID = /^\d{1,20}$/;
export const validIds = (ids: unknown): string[] =>
  Array.isArray(ids) ? [...new Set(ids.filter((i): i is string => typeof i === "string" && VALID_ID.test(i)))] : [];
