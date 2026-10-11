// Talking to the Offset browser extension from the site. The extension's
// content script on our pages answers window messages: it opens each service
// in a background tab where the person is already logged in, counts the last
// 30 days, closes the tab and sends back only the counts. The contract is in
// the README of github.com/tarter-ian/offset-extension.

export type ExtensionService = "chatgpt" | "claude" | "gemini" | "youtube";
export const EXTENSION_SERVICES: ExtensionService[] = ["chatgpt", "claude", "gemini", "youtube"];
/** Why a service couldn't be counted: logged out, tab closed by the person, too slow, or not supported. */
const DENIED: unknown[] = ["denied", "not-allowed", "not_allowed", "permission-denied"];

export type ExtensionError = "signed-out" | "closed" | "timeout" | "denied" | "unavailable";

const SITE = "offset-site";
const EXT = "offset-extension";

type ExtMessage = {
  source: typeof EXT;
  type: "ready" | "started" | "counting" | "usage" | "error";
  version?: string;
  requestId?: string;
  service?: ExtensionService;
  services?: ExtensionService[];
  /** Services the person is being asked to allow before they're counted. */
  needsPermission?: ExtensionService[];
  usage?: unknown;
  error?: string;
};

const fromExtension = (e: MessageEvent): ExtMessage | null =>
  e.source === window && e.data && typeof e.data === "object" && e.data.source === EXT ? (e.data as ExtMessage) : null;

const post = (msg: Record<string, unknown>) => window.postMessage({ source: SITE, ...msg }, window.location.origin);

/** Resolves with the extension's version, or null if it isn't installed. */
export function detectExtension(timeoutMs = 1000): Promise<string | null> {
  return new Promise((resolve) => {
    const done = (v: string | null) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      const m = fromExtension(e);
      if (m?.type === "ready") done(m.version ?? "unknown");
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => done(null), timeoutMs);
    post({ type: "ping" });
  });
}

export interface MeasureHandlers {
  onUsage: (service: ExtensionService, usage: unknown) => void;
  onError: (service: ExtensionService, error: ExtensionError) => void;
  /** Services waiting on the person to allow access in the extension's own window. */
  onAsking?: (services: ExtensionService[]) => void;
  /** Services that were allowed and are now counting. */
  onCounting?: (services: ExtensionService[]) => void;
  /** Called once every service has answered. */
  onDone?: () => void;
}

/**
 * Asks the extension to measure services. With one service and `inFront`, its tab opens in front
 * so the person can log in first. Returns a function that stops listening.
 */
export function measure(services: ExtensionService[], handlers: MeasureHandlers, inFront = false): () => void {
  const requestId = Math.random().toString(36).slice(2);
  const waiting = new Set(services);
  const settle = (s: ExtensionService) => {
    waiting.delete(s);
    if (!waiting.size) {
      stop();
      handlers.onDone?.();
    }
  };
  const onMessage = (e: MessageEvent) => {
    const m = fromExtension(e);
    if (!m || m.requestId !== requestId) return;
    // The extension couldn't start at all: every service fails the same way.
    if (m.type === "error" && !m.service) {
      for (const s of [...waiting]) {
        handlers.onError(s, "unavailable");
        settle(s);
      }
      return;
    }
    if (m.type === "started") {
      if (Array.isArray(m.needsPermission) && m.needsPermission.length) handlers.onAsking?.(m.needsPermission.filter((s) => waiting.has(s)));
      return;
    }
    // The person allowed access and this service's count has begun.
    if (m.type === "counting") {
      if (m.service && waiting.has(m.service)) handlers.onCounting?.([m.service]);
      return;
    }
    if (!m.service || !waiting.has(m.service)) return;
    if (m.type === "usage") {
      handlers.onUsage(m.service, m.usage);
      settle(m.service);
    }
    if (m.type === "error") {
      // A person saying no to site access may be reported under any of these names.
      const raw = DENIED.includes(m.error) ? "denied" : m.error;
      const err = (["signed-out", "closed", "timeout", "denied", "unavailable"] as const).find((x) => x === raw) ?? "unavailable";
      handlers.onError(m.service, err);
      settle(m.service);
    }
  };
  const stop = () => window.removeEventListener("message", onMessage);
  window.addEventListener("message", onMessage);
  if (inFront && services.length === 1) post({ type: "measure", service: services[0], requestId });
  else post({ type: "measure-all", services, requestId });
  return stop;
}

/** Chrome and Edge on a computer, where the extension can be installed. */
export function canInstallExtension(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Mobile|Android|CriOS|EdgiOS|OPR\//.test(ua);
}

/** Chrome Web Store page, once the extension is listed. */
export const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "";
