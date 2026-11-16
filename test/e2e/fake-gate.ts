/**
 * Minimal fake of Tower's gate for end-to-end tests. Listens on the origin the
 * extension was built for (build with VITE_GATE_URL=http://localhost:8000) and records every request.
 */
import http from "node:http";

export interface Recorded { method: string; path: string; headers: http.IncomingHttpHeaders; body: any }

export interface FakeGateOptions {
  keywords?: string[];
  verdicts?: Record<string, unknown>;
  badges?: Record<string, unknown>;
}

export function startFakeGate(port = 8000, opts: FakeGateOptions = {}) {
  const requests: Recorded[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
      requests.push({ method: req.method ?? "GET", path: url.pathname + url.search, headers: req.headers, body });
      const json = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(JSON.stringify(payload));
      };
      const p = url.pathname;
      if (p === "/v1/ingest/config") return json(200, { version: "e2e.1", filters: { keywords: opts.keywords ?? [], accounts: [], thresholds: {} } }, { etag: '"e2e1"' });
      if (p === "/v1/ingest/observations") {
        const n = body?.items?.length ?? 0;
        return json(202, { accepted: n, new: n, duplicates: 0, rejected: 0, errors: [] });
      }
      const verdict = p.match(/^\/v1\/content\/x\/(\d+)\/verdict$/);
      if (verdict) {
        const v = opts.verdicts?.[verdict[1]!];
        return v ? json(200, v) : json(404, { error: { code: "TWR-FCK-013", message: "no verdict" } });
      }
      if (p === "/v1/badges/categories") return json(200, [
        { category: "institutional", color: "#FF7A00", rank: 1 }, { category: "media", color: "#D946EF", rank: 2 },
        { category: "expert", color: "#00A0C0", rank: 3 }, { category: "organization", color: "#FFBF00", rank: 4 },
        { category: "personality", color: "#335CFF", rank: 5 },
      ]);
      if (p === "/v1/badges/lookup") {
        const ids = (url.searchParams.get("ids") ?? "").split(",");
        const accounts = Object.fromEntries(ids.filter((id) => opts.badges?.[id]).map((id) => [id, opts.badges![id]]));
        return json(200, { accounts }, { etag: `"${ids.join("-")}"` });
      }
      if (p.startsWith("/v1/badges/accounts/")) return json(404, { error: { code: "TWR-BDG-001", message: "none" } });
      if (p === "/v1/badges/x-government-hints") return json(202, { queued: body?.ids?.length ?? 0 });
      if (p === "/v1/badges/requests" || p === "/v1/badges/reports") return json(201, { ok: true });
      if (p === "/health") return json(200, { status: "ok" });
      json(404, { error: { code: "TWR-GEN-404", message: "not found" } });
    });
  });
  return new Promise<{ requests: Recorded[]; close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ requests, close: () => new Promise((r) => server.close(() => r())) }));
  });
}
