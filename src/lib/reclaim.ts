import { createHmac, timingSafeEqual } from "node:crypto";
import type { ActivityEvent } from "./activity";
import { parseNetflix } from "./activity";
import { levelForPlan, type AiLevel } from "./ai/levels";

// Signing in to Spotify, YouTube, Netflix, Uber or an AI service through Reclaim Protocol
// (https://docs.reclaimprotocol.org). The person signs in on their own device;
// Reclaim returns a signed proof of the data, which the server checks before
// using it. Needs RECLAIM_APP_ID, RECLAIM_APP_SECRET and one provider id per
// service, all as environment variables; a service without its id stays off.

export const RECLAIM_SERVICES = {
  netflix: { name: "Netflix", env: "RECLAIM_PROVIDER_NETFLIX", kind: "activity" },
  youtube: { name: "YouTube", env: "RECLAIM_PROVIDER_YOUTUBE", kind: "activity" },
  spotify: { name: "Spotify", env: "RECLAIM_PROVIDER_SPOTIFY", kind: "activity" },
  uber: { name: "Uber", env: "RECLAIM_PROVIDER_UBER", kind: "activity" },
  // These prove only the account and its plan, not how much it's used.
  chatgpt: { name: "ChatGPT", env: "RECLAIM_PROVIDER_CHATGPT", kind: "ai" },
  claude: { name: "Claude", env: "RECLAIM_PROVIDER_CLAUDE", kind: "ai" },
  perplexity: { name: "Perplexity", env: "RECLAIM_PROVIDER_PERPLEXITY", kind: "ai" },
} as const;
export type ReclaimService = keyof typeof RECLAIM_SERVICES;
export type ReclaimKind = (typeof RECLAIM_SERVICES)[ReclaimService]["kind"];

export const isReclaimService = (s: unknown): s is ReclaimService => typeof s === "string" && s in RECLAIM_SERVICES;

export function reclaimConfig(service: ReclaimService) {
  const appId = process.env.RECLAIM_APP_ID;
  const secret = process.env.RECLAIM_APP_SECRET;
  const providerId = process.env[RECLAIM_SERVICES[service].env];
  return appId && secret && providerId ? { appId, secret, providerId } : null;
}

export const enabledReclaimServices = (kind?: ReclaimKind) =>
  (Object.keys(RECLAIM_SERVICES) as ReclaimService[]).filter((s) => (!kind || RECLAIM_SERVICES[s].kind === kind) && reclaimConfig(s));

const PLAN_KEYS = ["membershipTier", "membership_tier", "tier", "plan", "planType", "plan_type", "subscription", "subscriptionStatus", "subscription_status", "currentPlan", "accountType"];

/** The plan an AI sign-in proved, like "plus" or "free", and the usage level it suggests. */
export function reclaimAiPlan(params: Record<string, string>, publicData?: unknown): { plan: string; level: AiLevel } | null {
  let pub: unknown = publicData;
  if (typeof pub === "string") {
    try {
      pub = JSON.parse(pub);
    } catch {
      pub = null;
    }
  }
  const found = [params, isObj(pub) ? pub : {}].map((r) => pick(r, PLAN_KEYS)).find((v) => v !== undefined);
  if (found === undefined) return null;
  const plan = typeof found === "boolean" ? (found ? "paid" : "free") : String(found).trim();
  return plan ? { plan, level: levelForPlan(plan) } : null;
}

/** A token tying a proof to a session this server started, so a proof from someone else's session is refused. */
export function sessionToken(sessionId: string, service: ReclaimService, version: string, secret: string) {
  return createHmac("sha256", secret).update(`${service}:${sessionId}:${version}`).digest("hex");
}
export function checkSessionToken(token: string, sessionId: string, service: ReclaimService, version: string, secret: string) {
  const want = Buffer.from(sessionToken(sessionId, service, version, secret), "hex");
  const got = Buffer.from(token, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const pick = (r: Record<string, unknown>, keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== "");

/** Lists of rows inside the extracted parameters; providers often return them as JSON strings. */
function rows(params: Record<string, string>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const v of Object.values(params)) {
    try {
      const parsed = JSON.parse(v);
      const list = Array.isArray(parsed) ? parsed : isObj(parsed) ? Object.values(parsed).find(Array.isArray) : null;
      if (Array.isArray(list)) out.push(...list.filter(isObj));
    } catch {
      // A plain value, not a list.
    }
  }
  return out;
}

/** Reads a date like "2026-09-30T20:00:00Z", "9/30/26" or a Unix time in seconds or milliseconds. */
function parseTime(v: unknown): number {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const text = String(v ?? "");
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) return Date.UTC(Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  return /^\d{10,13}$/.test(text) ? parseTime(Number(text)) : Date.parse(text);
}

/** Miles from a number (assumed miles) or text like "5.2 mi" or "8.4 km". */
function parseMiles(v: unknown): number {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/([\d.]+)\s*(km|kilomet|mi)?/i);
  if (!m) return NaN;
  return /^k/i.test(m[2] ?? "") ? Number(m[1]) / 1.609344 : Number(m[1]);
}

const listIn = (raw: unknown, keys: string[]): Record<string, unknown>[] => {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!isObj(data)) return [];
  const list = keys.map((k) => data[k]).find(Array.isArray);
  return Array.isArray(list) ? list.filter(isObj) : [];
};

/**
 * Turns what a sign-in returned into activity. The providers chosen in the
 * Reclaim dashboard (2026-10-11) return their history as public data next to
 * the proof: Netflix `watchHistory[]` of {title, date}, Spotify `tracks[]` of
 * {played_at, track: {duration_ms}} (the last ~50 plays), and Uber `rides[]`
 * as Uber's own data page lists them. Only account ownership is proven; the
 * history is what the person's own browser collected, which is fine for
 * estimating their own footprint. Extracted parameters are checked too, in case
 * a provider is swapped for one that proves the list itself.
 */
export function reclaimEvents(service: ReclaimService, params: Record<string, string>, publicData?: unknown): ActivityEvent[] {
  if (service === "netflix") {
    const csv = Object.values(params).find((v) => /Start Time|Title,Date/.test(v));
    if (csv) return parseNetflix(csv) ?? [];
  }
  const fromPublic =
    service === "netflix"
      ? listIn(publicData, ["watchHistory", "viewingActivity", "history"])
      : service === "spotify"
        ? listIn(publicData, ["tracks", "items", "recentlyPlayed"])
        : service === "uber"
          ? listIn(publicData, ["rides", "trips"])
          : listIn(publicData, ["watchHistory", "history", "videos"]);
  const list = fromPublic.length ? fromPublic : rows(params);
  return list.flatMap((r): ActivityEvent[] => {
    const time = parseTime(
      pick(r, ["played_at", "date", "time", "ts", "startTime", "start_time", "requestTime", "request_time", "requestedAt", "begintrip_timestamp", "beginTripTime", "tripTime", "endTime", "createdAt"]),
    );
    if (!Number.isFinite(time)) return [];
    if (service === "uber") {
      const status = String(pick(r, ["status", "tripStatus", "state"]) ?? "").toLowerCase();
      if (/cancel/.test(status)) return [];
      const miles = parseMiles(pick(r, ["distance", "distanceMiles", "distance_miles", "distanceInMiles", "tripDistance", "trip_distance", "miles"]));
      return miles > 0 ? [{ target: "car", time, amount: miles }] : [];
    }
    if (service === "spotify") {
      const track = isObj(r.track) ? r.track : {};
      const ms = Number(pick(r, ["ms_played", "msPlayed", "duration_ms", "durationMs"]) ?? pick(track, ["duration_ms", "durationMs"]));
      return ms > 0 ? [{ target: "music", time, amount: ms / 3_600_000, sample: true }] : [];
    }
    const seconds = Number(pick(r, ["durationSeconds", "duration_seconds", "watchSeconds"]));
    const hours = seconds > 0 ? seconds / 3600 : service === "youtube" ? 12 / 60 : 40 / 60;
    return [{ target: "video", time, amount: hours }];
  });
}
