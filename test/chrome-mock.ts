/**
 * Minimal in-memory `chrome` API for unit tests. Covers what the extension uses:
 * storage.local / storage.session (+ onChanged), runtime.sendMessage / onMessage /
 * getURL / onInstalled, alarms, i18n, tabs.create. Call `resetChromeMock()` in
 * beforeEach. Tests can set `chromeMock.messageHandler` to answer sendMessage.
 */
import { vi } from "vitest";

type Listener = (...args: any[]) => any;
const event = () => {
  const ls = new Set<Listener>();
  return {
    addListener: (l: Listener) => void ls.add(l),
    removeListener: (l: Listener) => void ls.delete(l),
    hasListener: (l: Listener) => ls.has(l),
    _fire: (...a: any[]) => [...ls].map((l) => l(...a)),
    _listeners: ls,
  };
};

function storageArea(name: "local" | "session", onChanged: ReturnType<typeof event>) {
  let data: Record<string, any> = {};
  const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));
  return {
    _reset: () => void (data = {}),
    _dump: () => data,
    get: vi.fn(async (keys?: string | string[] | Record<string, any> | null) => {
      if (keys == null) return clone(data);
      if (typeof keys === "string") return keys in data ? { [keys]: clone(data[keys]) } : {};
      if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, clone(data[k])]));
      return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in data ? clone(data[k]) : d]));
    }),
    set: vi.fn(async (items: Record<string, any>) => {
      const changes: Record<string, any> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: clone(data[k]), newValue: clone(v) };
        data[k] = clone(v);
      }
      onChanged._fire(changes, name);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Record<string, any> = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (k in data) changes[k] = { oldValue: data[k] };
        delete data[k];
      }
      onChanged._fire(changes, name);
    }),
    clear: vi.fn(async () => void (data = {})),
  };
}

const onChanged = event();
export const chromeMock = {
  messageHandler: null as null | ((msg: any) => any),
  storage: { local: storageArea("local", onChanged), session: storageArea("session", onChanged), onChanged },
  runtime: {
    id: "test-extension-id",
    lastError: undefined as undefined | { message: string },
    getURL: (p: string) => `chrome-extension://test-extension-id/${p.replace(/^\//, "")}`,
    sendMessage: vi.fn(async (msg: any) => (chromeMock.messageHandler ? chromeMock.messageHandler(msg) : undefined)),
    onMessage: event(),
    onInstalled: event(),
    onStartup: event(),
    openOptionsPage: vi.fn(async () => {}),
  },
  alarms: {
    _alarms: new Map<string, any>(),
    create: vi.fn((name: string, info: any) => void chromeMock.alarms._alarms.set(name, { name, ...info })),
    get: vi.fn(async (name: string) => chromeMock.alarms._alarms.get(name)),
    clear: vi.fn(async (name: string) => chromeMock.alarms._alarms.delete(name)),
    onAlarm: event(),
  },
  i18n: { getUILanguage: () => "fr-FR", getMessage: (_k: string) => "" },
  tabs: { create: vi.fn(async (_: any) => ({})) },
  action: { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}), setIcon: vi.fn(async () => {}) },
};

export function resetChromeMock() {
  chromeMock.storage.local._reset();
  chromeMock.storage.session._reset();
  chromeMock.storage.onChanged._listeners.clear();
  chromeMock.runtime.onMessage._listeners.clear();
  chromeMock.alarms._alarms.clear();
  chromeMock.messageHandler = null;
  vi.clearAllMocks();
}

(globalThis as any).chrome = chromeMock;
