import type { Covered } from "./covered";

// Accounts hold an email and what's covered, nothing more (Ian, 2026-10-12):
// usage counts stay on the computer that measured them. Signing in is a 6-digit
// code or a link, both sent by email; there are no passwords.

export const accountsOn = () => process.env.NEXT_PUBLIC_ACCOUNTS_ON === "1";

/** How long a code or link works, and how many wrong codes end it. */
export const SIGN_IN_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
/** The least time between two emails to the same address. */
export const RESEND_SECONDS = 60;
/** Deleting right away needs a sign-in this recent; otherwise a fresh link is emailed first. */
export const FRESH_MINUTES = 15;
export const SESSION_COOKIE = "mo_session";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/** The address in a form we can compare: trimmed and lower case, or null if it isn't one. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

export const isCode = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v);

/** Random bytes as hex. */
export function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** A 6-digit code, every digit equally likely. */
export function newCode(): string {
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b);
  while (b[0] >= 4_294_000_000); // Drop the top sliver so each code is equally likely.
  return String(b[0] % 1_000_000).padStart(6, "0");
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

const ID = /^[a-z0-9-]{1,40}$/;
const isDate = (v: unknown): v is string => typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v));

/** What's covered, checked item by item; anything malformed is dropped. */
export function cleanCovered(v: unknown): Record<string, Covered> {
  const out: Record<string, Covered> = {};
  if (typeof v !== "object" || !v || Array.isArray(v)) return out;
  for (const [id, raw] of Object.entries(v).slice(0, 100)) {
    const c = raw as Record<string, unknown>;
    if (!ID.test(id) || typeof c !== "object" || !c) continue;
    const extra = {
      ...(isDate(c.since) ? { since: c.since } : {}),
      ...(typeof c.giftFrom === "string" && c.giftFrom.trim() ? { giftFrom: c.giftFrom.trim().slice(0, 60) } : {}),
    };
    if (c.kind === "life") out[id] = { kind: "life", ...extra };
    else if (c.kind === "period" && isDate(c.until)) out[id] = { kind: "period", until: c.until, ...extra };
  }
  return out;
}

const earlier = (a?: string, b?: string) => (a && b ? (a < b ? a : b) : (a ?? b));

/** Two records of what's covered as one: for life beats a period, a later end beats an earlier one, and the first start is kept. */
export function mergeCovered(a: Record<string, Covered>, b: Record<string, Covered>): Record<string, Covered> {
  const out: Record<string, Covered> = { ...a };
  for (const [id, y] of Object.entries(b)) {
    const x = out[id];
    if (!x) {
      out[id] = y;
      continue;
    }
    const win = x.kind === "life" ? x : y.kind === "life" ? y : Date.parse(y.until) > Date.parse(x.until) ? y : x;
    const since = earlier(x.since, y.since);
    out[id] = { ...win, ...(since ? { since } : {}) };
  }
  return out;
}

/** True when b has nothing a doesn't already cover as well or better. */
export const coversAll = (a: Record<string, Covered>, b: Record<string, Covered>) =>
  JSON.stringify(mergeCovered(a, b)) === JSON.stringify(mergeCovered(a, {}));
