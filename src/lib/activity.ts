import { strFromU8, unzipSync } from "fflate";

// Reads the data downloads people can get from Spotify, YouTube (Google
// Takeout), Netflix and Google Maps Timeline, in the browser, and turns them
// into the amounts on the store's tiles. Nothing is uploaded.

export type ActivitySource = "spotify" | "youtube" | "netflix" | "timeline" | "uber";
type Target = "music" | "video" | "car" | "transit" | "flights";

/** One thing that happened: hours of listening or watching, miles travelled, or a flight leg. */
export interface ActivityEvent {
  target: Target;
  time: number;
  /** Hours for music and video, miles for car and transit, legs for flights. */
  amount: number;
  /** A short recent sample (like Spotify's last 50 songs), averaged over its own span rather than at least a month. */
  sample?: boolean;
}

export interface ActivityFile {
  source: ActivitySource;
  events: ActivityEvent[];
}

export const SOURCE_NAMES: Record<ActivitySource, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  netflix: "Netflix",
  timeline: "Google Maps",
  uber: "Uber",
};

/** YouTube's history lists videos without how long you watched; this is a rough average. */
export const YOUTUBE_MIN_PER_VIDEO = 12;
/** Shorts run up to a minute (three since late 2024); most are watched for well under one. */
export const YOUTUBE_MIN_PER_SHORT = 0.5;
export const YOUTUBE_MUSIC_MIN_PER_SONG = 3.5;
/** Netflix's simple viewing history lists titles without durations. */
export const NETFLIX_MIN_PER_TITLE = 40;

const HOUR_MS = 3_600_000;
const MILES_PER_METER = 1 / 1609.344;

const time = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  // Spotify's account data uses "2024-01-31 18:20" in UTC.
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v) ? `${v.replace(" ", "T")}Z` : v);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function spotify(rows: unknown[]): ActivityEvent[] | null {
  const first = rows.find(isObj);
  if (!first || !("ms_played" in first || "msPlayed" in first)) return null;
  return rows.filter(isObj).flatMap((r) => {
    const ms = Number(r.ms_played ?? r.msPlayed);
    const t = time(r.ts ?? r.endTime);
    return ms > 0 && Number.isFinite(t) ? [{ target: "music" as const, time: t, amount: ms / HOUR_MS }] : [];
  });
}

function youtube(rows: unknown[]): ActivityEvent[] | null {
  const first = rows.find(isObj);
  if (!first || !/^YouTube/.test(String(first.header)) || !("title" in first)) return null;
  return rows.filter(isObj).flatMap((r): ActivityEvent[] => {
    const ad = Array.isArray(r.details) && r.details.some((d) => isObj(d) && /Ads/i.test(String(d.name)));
    const t = time(r.time);
    if (ad || !String(r.title).startsWith("Watched") || !Number.isFinite(t)) return [];
    return r.header === "YouTube Music"
      ? [{ target: "music" as const, time: t, amount: YOUTUBE_MUSIC_MIN_PER_SONG / 60 }]
      : [{ target: "video" as const, time: t, amount: YOUTUBE_MIN_PER_VIDEO / 60 }];
  });
}

const CAR = new Set(["IN_PASSENGER_VEHICLE", "IN_VEHICLE", "DRIVING", "IN_CAR", "IN_TAXI", "MOTORCYCLING"]);
const TRANSIT = new Set(["IN_BUS", "IN_TRAIN", "IN_SUBWAY", "IN_TRAM", "IN_FERRY", "IN_RAIL_VEHICLE"]);

function segment(type: unknown, meters: unknown, start: unknown): ActivityEvent | null {
  const kind = String(type ?? "").toUpperCase().replace(/\s+/g, "_");
  const t = time(start);
  if (!Number.isFinite(t)) return null;
  if (kind === "FLYING") return { target: "flights", time: t, amount: 1 };
  const miles = Number(meters) * MILES_PER_METER;
  if (!(miles > 0)) return null;
  if (CAR.has(kind)) return { target: "car", time: t, amount: miles };
  if (TRANSIT.has(kind)) return { target: "transit", time: t, amount: miles };
  return null;
}

/** Google Maps Timeline, from the phone export (Timeline.json) or older Takeout monthly files. */
function timeline(data: unknown): ActivityEvent[] | null {
  const segs: (ActivityEvent | null)[] = [];
  if (isObj(data) && Array.isArray(data.semanticSegments)) {
    for (const s of data.semanticSegments.filter(isObj)) {
      const a = isObj(s.activity) ? s.activity : null;
      if (a) segs.push(segment(isObj(a.topCandidate) ? a.topCandidate.type : undefined, a.distanceMeters, s.startTime));
    }
  } else if (isObj(data) && Array.isArray(data.timelineObjects)) {
    for (const o of data.timelineObjects.filter(isObj)) {
      const a = isObj(o.activitySegment) ? o.activitySegment : null;
      const d = a && isObj(a.duration) ? a.duration : {};
      if (a) segs.push(segment(a.activityType, a.distance, d.startTimestamp ?? Number(d.startTimestampMs)));
    }
  } else if (Array.isArray(data) && data.some((r) => isObj(r) && isObj(r.activity))) {
    for (const r of data.filter(isObj)) {
      const a = isObj(r.activity) ? r.activity : null;
      if (a) segs.push(segment(isObj(a.topCandidate) ? a.topCandidate.type : undefined, a.distanceMeters, r.startTime));
    }
  } else return null;
  return segs.filter((s) => s !== null);
}

/** Splits a CSV line, allowing quoted fields with commas. */
function csvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const hms = (s: string) => {
  const [h, m, sec] = s.split(":").map(Number);
  return (h || 0) + (m || 0) / 60 + (sec || 0) / 3600;
};

/** Netflix's full download (ViewingActivity.csv, with durations) or its simple viewing history (title and date). */
export function parseNetflix(csv: string): ActivityEvent[] | null {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  const head = csvRow(lines[0]).map((h) => h.trim());
  const col = (name: string) => head.indexOf(name);
  const rows = lines.slice(1).map(csvRow);
  if (col("Start Time") >= 0 && col("Duration") >= 0) {
    const extra = col("Supplemental Video Type");
    return rows.flatMap((r) => {
      const t = time(`${r[col("Start Time")]?.replace(" ", "T")}Z`);
      const h = hms(r[col("Duration")] ?? "");
      return Number.isFinite(t) && h > 0 && !(extra >= 0 && r[extra]) ? [{ target: "video" as const, time: t, amount: h }] : [];
    });
  }
  if (col("Title") >= 0 && col("Date") >= 0) {
    return rows.flatMap((r) => {
      const [m, d, y] = (r[col("Date")] ?? "").split("/").map(Number);
      const t = Date.UTC(y < 100 ? 2000 + y : y, m - 1, d);
      return Number.isFinite(t) ? [{ target: "video" as const, time: t, amount: NETFLIX_MIN_PER_TITLE / 60 }] : [];
    });
  }
  return null;
}

/** Works out which service a JSON file came from and reads it. */
export function parseActivityJson(data: unknown): ActivityFile | null {
  if (Array.isArray(data)) {
    const s = spotify(data);
    if (s) return { source: "spotify", events: s };
    const y = youtube(data);
    if (y) return { source: "youtube", events: y };
  }
  const t = timeline(data);
  return t ? { source: "timeline", events: t } : null;
}

const WANTED = /(streaming_?history[^/]*\.json|watch-history\.json|viewingactivity\.csv|netflixviewinghistory\.csv|timeline\.json|semantic location history\/.*\.json)$/i;

/** Reads one downloaded file (.zip, .json or .csv) into one or more sources' events. */
export async function readActivityFile(file: File): Promise<ActivityFile[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const texts: [string, string][] = file.name.toLowerCase().endsWith(".zip")
    ? Object.entries(unzipSync(bytes, { filter: (f) => WANTED.test(f.name) && !/video/i.test(f.name.split("/").pop()!) })).map(
        ([n, b]) => [n, strFromU8(b)],
      )
    : [[file.name, strFromU8(bytes)]];
  const found: ActivityFile[] = [];
  for (const [name, text] of texts) {
    if (name.toLowerCase().endsWith(".csv")) {
      const n = parseNetflix(text);
      if (n) found.push({ source: "netflix", events: n });
      continue;
    }
    try {
      const f = parseActivityJson(JSON.parse(text));
      if (f) found.push(f);
    } catch {
      // Not JSON we understand; skip it.
    }
  }
  // Merge files from the same service, like Spotify's yearly or Takeout's monthly files.
  const merged = new Map<ActivitySource, ActivityEvent[]>();
  for (const f of found) merged.set(f.source, [...(merged.get(f.source) ?? []), ...f.events]);
  return [...merged].map(([source, events]) => ({ source, events }));
}

const DAY_MS = 86_400_000;

export interface ActivityAmounts {
  /** Tile amounts by product id, in each tile's own unit. */
  amounts: Partial<Record<"music" | "video" | "car" | "transit" | "flights", number>>;
  /** Days of history the averages cover. */
  days: number;
}

/**
 * Averages the last year of events (or the whole history, if shorter) into
 * hours a day, miles a week and round trips a year. The year ends at the
 * newest event, so an old download still gives a typical year.
 */
export function activityAmounts(events: ActivityEvent[], now = Date.now()): ActivityAmounts | null {
  const past = events.filter((e) => e.time <= now);
  if (!past.length) return null;
  const amounts: ActivityAmounts["amounts"] = {};
  let longest = 0;
  const round = (n: number, step: number) => Math.round(n / step) * step;
  // Listening and watching each get their own year, so a Spotify file doesn't stretch a short
  // Netflix one. Travel shares one, since a year of Timeline with two flights is two flights a year.
  const group = (t: Target): Target[] => (t === "music" || t === "video" ? [t] : ["car", "transit", "flights"]);
  for (const t of ["music", "video", "car", "transit", "flights"] as const) {
    if (!past.some((e) => e.target === t)) continue;
    const span = past.filter((e) => group(t).includes(e.target));
    const end = Math.max(...span.map((e) => e.time));
    const from = end - 365 * DAY_MS;
    const inYear = span.filter((e) => e.time > from);
    const minDays = inYear.every((e) => e.sample) ? 1 : 30;
    const days = Math.max(minDays, (end - Math.min(...inYear.map((e) => e.time))) / DAY_MS);
    longest = Math.max(longest, days);
    const sum = past.filter((e) => e.target === t && e.time > from).reduce((s, e) => s + e.amount, 0);
    if (t === "music" || t === "video") amounts[t] = round(sum / days, 0.05);
    else if (t === "flights") amounts[t] = round(((sum / 2) * 365) / days, 0.5);
    else amounts[t] = Math.round((sum / days) * 7);
  }
  return { amounts, days: Math.round(longest) };
}
