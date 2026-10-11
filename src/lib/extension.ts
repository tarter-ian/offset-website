// Talking to the Offset browser extension from the site. The extension's
// content script on our pages answers window messages; it opens the AI service
// in a tab where the person is already logged in, counts the last 30 days and
// sends back only the counts. See extension/README.md for the full contract.

export type ExtensionService = "chatgpt" | "claude" | "gemini";

const SITE = "offset-site";
const EXT = "offset-extension";

interface ExtMessage {
  source: typeof EXT;
  type: "ready" | "progress" | "result" | "error";
  id?: string;
  version?: string;
  services?: string[];
  text?: string;
  usage?: unknown;
  message?: string;
}

const fromExtension = (e: MessageEvent): ExtMessage | null =>
  e.source === window && e.data && typeof e.data === "object" && e.data.source === EXT ? (e.data as ExtMessage) : null;

/** Resolves with the services the extension can count, or null if it isn't installed. */
export function detectExtension(timeoutMs = 600): Promise<string[] | null> {
  return new Promise((resolve) => {
    const done = (v: string[] | null) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      const m = fromExtension(e);
      if (m?.type === "ready") done(m.services ?? ["chatgpt", "claude"]);
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => done(null), timeoutMs);
    window.postMessage({ source: SITE, type: "ping" }, window.location.origin);
  });
}

/** Asks the extension to count a service. Resolves with its usage counts; rejects with a readable message. */
export function countWithExtension(service: ExtensionService, onProgress?: (text: string) => void): Promise<unknown> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const m = fromExtension(e);
      if (!m || m.id !== id) return;
      if (m.type === "progress" && m.text) onProgress?.(m.text);
      if (m.type === "result") {
        window.removeEventListener("message", onMessage);
        resolve(m.usage);
      }
      if (m.type === "error") {
        window.removeEventListener("message", onMessage);
        reject(new Error(m.message || "The extension couldn't count your use."));
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: SITE, type: "count", service, id }, window.location.origin);
  });
}

/** Chrome and Edge on a computer, where the extension can be installed. */
export function canInstallExtension(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/Mobile|Android|CriOS|EdgiOS|OPR\//.test(ua);
}

/** Chrome Web Store page, once the extension is listed. */
export const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "";
