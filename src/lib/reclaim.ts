import { createHmac, timingSafeEqual } from "node:crypto";
import type { ActivityEvent } from "./activity";
import { parseNetflix } from "./activity";

// Signing in to Spotify, YouTube, Netflix or Uber through Reclaim Protocol
// (https://docs.reclaimprotocol.org). The person signs in on their own device;
// Reclaim returns a signed proof of the data, which the server checks before
// using it. Needs RECLAIM_APP_ID, RECLAIM_APP_SECRET and one provider id per
// service, all as environment variables; a service without its id stays off.

export const RECLAIM_SERVICES = {
  netflix: { name: "Netflix", env: "RECLAIM_PROVIDER_NETFLIX" },
  youtube: { name: "YouTube", env: "RECLAIM_PROVIDER_YOUTUBE" },
  spotify: { name: "Spotify", env: "RECLAIM_PROVIDER_SPOTIFY" },
  uber: { name: "Uber", env: "RECLAIM_PROVIDER_UBER" },
} as const;
export type ReclaimService = keyof typeof RECLAIM_SERVICES;

export const isReclaimService = (s: unknown): s is ReclaimService => typeof s === "string" && s in RECLAIM_SERVICES;

export function reclaimConfig(service: ReclaimService) {
  const appId = process.env.RECLAIM_APP_ID;
  const secret = process.env.RECLAIM_APP_SECRET;
  const providerId = process.env[RECLAIM_SERVICES[service].env];
  return appId && secret && providerId ? { appId, secret, providerId } : null;
}

export const enabledReclaimServices = () => (Object.keys(RECLAIM_SERVICES) as ReclaimService[]).filter((s) => reclaimConfig(s));

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
const toTime = (v: unknown) => (typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(String(v)));

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

/**
 * Turns a verified proof's extracted data into activity. Each provider names its
 * fields differently, so this accepts the common names; check them against the
 * providers chosen in the Reclaim dashboard.
 */
export function reclaimEvents(service: ReclaimService, params: Record<string, string>): ActivityEvent[] {
  if (service === "netflix") {
    const csv = Object.values(params).find((v) => /Start Time|Title,Date/.test(v));
    if (csv) return parseNetflix(csv) ?? [];
  }
  return rows(params).flatMap((r): ActivityEvent[] => {
    const time = toTime(pick(r, ["time", "date", "ts", "startTime", "start_time", "requestTime", "request_time", "played_at", "endTime"]));
    if (!Number.isFinite(time)) return [];
    if (service === "uber") {
      const miles = Number(pick(r, ["distance", "distanceMiles", "distance_miles", "miles"]));
      return miles > 0 ? [{ target: "car", time, amount: miles }] : [];
    }
    if (service === "spotify") {
      const ms = Number(pick(r, ["ms_played", "msPlayed", "duration_ms", "durationMs"]));
      return ms > 0 ? [{ target: "music", time, amount: ms / 3_600_000 }] : [];
    }
    const seconds = Number(pick(r, ["durationSeconds", "duration_seconds", "watchSeconds"]));
    const hours = seconds > 0 ? seconds / 3600 : service === "youtube" ? 12 / 60 : 40 / 60;
    return [{ target: "video", time, amount: hours }];
  });
}
