// Talking to the Offset browser extension from the site. The extension's
// content script on our pages answers window messages: it opens each service
// in a background tab where the person is already logged in, counts the last
// 30 days, closes the tab and sends back only the counts. The contract is in
// the README of github.com/tarter-ian/offset-extension.

export type ExtensionService = "chatgpt" | "claude" | "gemini" | "youtube" | "netflix" | "doordash" | "ubereats" | "amazon" | "uber";
export const EXTENSION_SERVICES: ExtensionService[] = ["chatgpt", "claude", "gemini", "youtube", "netflix", "doordash", "ubereats", "amazon", "uber"];
/** Why a service couldn't be counted: logged out, tab closed by the person, too slow, or not supported. */
const DENIED: unknown[] = ["denied", "not-allowed", "not_allowed", "permission-denied"];

export type ExtensionError = "signed-out" | "closed" | "timeout" | "denied" | "reload-page" | "unavailable";

const SITE = "offset-site";
const EXT = "offset-extension";

type ExtMessage = {
  source: typeof EXT;
  type: "ready" | "started" | "counting" | "progress" | "usage" | "error" | "forgotten" | "results";
  version?: string;
  requestId?: string;
  service?: ExtensionService;
  services?: ExtensionService[];
  /** Services the person is being asked to allow before they're counted. */
  needsPermission?: ExtensionService[];
  usage?: unknown;
  /** The last whole-history count (extension 0.19.0), sent beside `usage` once one has been made. */
  history?: unknown;
  error?: string;
};

/** Puts a whole-history count sent beside `usage` into it, unless the usage already has its own. */
const withHistory = (usage: unknown, history: unknown): unknown =>
  history && typeof usage === "object" && usage && !(usage as Record<string, unknown>).history ? { ...(usage as object), history } : usage;

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

/**
 * Asks the extension to delete everything it keeps between runs: saved results,
 * the day-by-day record and per-chat counts. Resolves true once it confirms, false if
 * it isn't installed or doesn't answer.
 */
export function forgetExtensionData(timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      if (fromExtension(e)?.type === "forgotten") done(true);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => done(false), timeoutMs);
    post({ type: "forget" });
  });
}

export interface MeasureHandlers {
  onUsage: (service: ExtensionService, usage: unknown) => void;
  onError: (service: ExtensionService, error: ExtensionError) => void;
  /** Services waiting on the person to allow access in the extension's own window. */
  onAsking?: (services: ExtensionService[]) => void;
  /** Services that were allowed and are now counting. */
  onCounting?: (services: ExtensionService[]) => void;
  /** A rough running figure while a slow count goes on (ChatGPT). Not for pricing: `usage` follows. */
  onProgress?: (service: ExtensionService, usage: unknown) => void;
  /** Called once every service has answered. */
  onDone?: () => void;
}

/**
 * Asks the extension to measure services. With one service and `inFront`, its tab opens in front
 * so the person can log in first. Returns a function that stops listening.
 */
export function measure(
  services: ExtensionService[],
  handlers: MeasureHandlers,
  inFront = false,
  maxAgeHours?: number,
  /** Read each account's whole history, not just 30 days (YouTube, Netflix and Gemini; slower). */
  history = false,
): () => void {
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
        handlers.onError(s, m.error === "reload-page" ? "reload-page" : "unavailable");
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
    if (m.type === "progress") {
      handlers.onProgress?.(m.service, m.usage);
      return;
    }
    if (m.type === "usage") {
      handlers.onUsage(m.service, withHistory(m.usage, m.history));
      settle(m.service);
    }
    if (m.type === "error") {
      // A person saying no to site access may be reported under any of these names.
      const raw = DENIED.includes(m.error) ? "denied" : m.error;
      const err = (["signed-out", "closed", "timeout", "denied", "reload-page", "unavailable"] as const).find((x) => x === raw) ?? "unavailable";
      handlers.onError(m.service, err);
      settle(m.service);
    }
  };
  const stop = () => window.removeEventListener("message", onMessage);
  window.addEventListener("message", onMessage);
  const whole = history ? { history: true } : {};
  if (inFront && services.length === 1) post({ type: "measure", service: services[0], requestId, ...whole });
  else post({ type: "measure-all", services, requestId, ...whole, ...(maxAgeHours && !history ? { maxAgeHours } : {}) });
  return stop;
}

/** A saved count, with every day the extension has counted for that service (`record`, oldest first). */
export type SavedResult = { usage: unknown; measuredAt: string; record?: unknown[] };

/** When a `usage` message was counted (extension 0.16.0 and later), if it says. */
export const measuredAtOf = (usage: unknown): string | undefined => {
  const at = typeof usage === "object" && usage ? (usage as Record<string, unknown>).measuredAt : undefined;
  return typeof at === "string" && Number.isFinite(Date.parse(at)) ? at : undefined;
};

/**
 * What the extension saved from earlier counts, without opening anything. Empty
 * when it isn't installed, is older than 0.16.0, or has nothing saved.
 */
export function savedResults(timeoutMs = 1500): Promise<Partial<Record<ExtensionService, SavedResult>>> {
  return new Promise((resolve) => {
    const done = (v: Partial<Record<ExtensionService, SavedResult>>) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      const m = fromExtension(e) as (ExtMessage & { results?: unknown }) | null;
      if (m?.type !== "results") return;
      const out: Partial<Record<ExtensionService, SavedResult>> = {};
      const results = typeof m.results === "object" && m.results ? (m.results as Record<string, unknown>) : {};
      for (const s of EXTENSION_SERVICES) {
        const r = results[s] as { usage?: unknown; measuredAt?: unknown; history?: unknown; record?: unknown } | undefined;
        if (r && r.usage && typeof r.measuredAt === "string" && Number.isFinite(Date.parse(r.measuredAt)))
          out[s] = { usage: withHistory(r.usage, r.history), measuredAt: r.measuredAt, ...(Array.isArray(r.record) ? { record: r.record } : {}) };
      }
      done(out);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => done({}), timeoutMs);
    post({ type: "results" });
  });
}

/** Chrome and Edge on a computer, where the extension can be installed. */
export function canInstallExtension(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Mobile|Android|CriOS|EdgiOS|OPR\//.test(ua);
}

/**
 * A phone or tablet, where the extension can never run, so the data export is the way to measure.
 * iPads say they're a Mac, so a touch screen without a mouse counts too.
 */
export function isPhoneAgent(ua: string, touchOnly: boolean): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/.test(ua) || (touchOnly && /Macintosh/.test(ua));
}

export function isPhone(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return isPhoneAgent(navigator.userAgent, window.matchMedia?.("(pointer: coarse)").matches && !window.matchMedia?.("(any-pointer: fine)").matches);
}

/** Chrome Web Store page, once the extension is listed. */
export const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "";
