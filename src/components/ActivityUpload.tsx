"use client";

import { useState } from "react";
import { YOUTUBE_MIN_PER_VIDEO, activityAmounts, readActivityFile, SOURCE_NAMES, type ActivityAmounts, type ActivityEvent, type ActivitySource } from "@/lib/activity";

const UNITS: Record<keyof ActivityAmounts["amounts"], (n: number) => string> = {
  music: (n) => `${n} hours a day of music and podcasts`,
  video: (n) => `${n} hours a day of video`,
  car: (n) => `${n} miles a week by car`,
  transit: (n) => `${n} miles a week by bus and train`,
  flights: (n) => `${n} round trips a year`,
  electricity: (n) => `${n} kWh a month of electricity`,
  heating: (n) => `about $${n} a month of gas`,
};

/** Reads Spotify, YouTube, Netflix, Google Maps and utility (Green Button) downloads in the browser and fills in the matching tiles. */
export function ActivityUpload({
  onResult,
}: {
  onResult: (a: ActivityAmounts["amounts"], from: Partial<Record<keyof ActivityAmounts["amounts"], ActivitySource[]>>) => void;
}) {
  const [sources, setSources] = useState<Partial<Record<ActivitySource, ActivityEvent[]>>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({ kind: "idle" });
  function apply(next: Partial<Record<ActivitySource, ActivityEvent[]>>) {
    setSources(next);
    const result = activityAmounts(Object.values(next).flat());
    if (!result) {
      setStatus({ kind: "error", text: "We didn't find any listening, watching, travel or energy history." });
      return;
    }
    const from: Partial<Record<keyof ActivityAmounts["amounts"], ActivitySource[]>> = {};
    for (const [src, events] of Object.entries(next) as [ActivitySource, ActivityEvent[]][]) {
      for (const t of new Set(events.map((e) => e.target))) from[t] = [...(from[t] ?? []), src];
    }
    onResult(result.amounts, from);
    const lines = (Object.entries(result.amounts) as [keyof ActivityAmounts["amounts"], number][]).map(([k, n]) => UNITS[k](n));
    setStatus({
      kind: "done",
      text: `From your ${Object.keys(next).map((s) => SOURCE_NAMES[s as ActivitySource]).join(", ")} history: ${lines.join(", ")}.`,
    });
  }

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setStatus({ kind: "reading" });
    try {
      const found = (await Promise.all([...files].map(readActivityFile))).flat();
      if (!found.some((f) => f.events.length)) {
        setStatus({ kind: "error", text: "We couldn't find any listening, watching, travel or energy history in that file." });
        return;
      }
      const next = { ...sources };
      for (const f of found) next[f.source] = f.events;
      apply(next);
    } catch {
      setStatus({ kind: "error", text: "We couldn't read that file. Try the .zip exactly as you downloaded it." });
    }
  }

  return (
    <div className="border-2 border-rule bg-card p-4">
      <p className="font-medium">Add your Spotify, YouTube, Netflix, Google Maps or utility history</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
        <li>
          Spotify: Account, Privacy settings, Download your data. Pick &ldquo;Extended streaming history&rdquo; for exact
          listening time.
        </li>
        <li>
          YouTube: on{" "}
          <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="underline">
            Google Takeout
          </a>
          , pick only YouTube, then history, in JSON. It lists videos but not how long you watched, so we assume{" "}
          about {YOUTUBE_MIN_PER_VIDEO} minutes each.
        </li>
        <li>Netflix: Account, Download your personal information. Or the Viewing activity page&apos;s Download all.</li>
        <li>
          Google Maps: in the app, Settings, Location and privacy, Export Timeline data. This fills in driving, bus and
          train, and flights.
        </li>
        <li>
          Your electricity or gas: on your utility&apos;s website, look for Green Button or &ldquo;Download my data&rdquo; on the
          usage page, and pick a year. Most US utilities offer it, as XML or CSV.
        </li>
      </ul>
      <p className="mt-1 text-sm text-muted">Add the .zip, .json, .csv or .xml. We read it in your browser; the file never leaves your device.</p>
      <input
        type="file"
        accept=".zip,.json,.csv,.xml,application/zip,application/json,text/csv,application/xml,text/xml"
        multiple
        onChange={(e) => handle(e.target.files)}
        aria-label="Spotify, YouTube, Netflix, Google Maps or utility history"
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-2 file:border-rule file:bg-background file:px-3 file:py-2 file:font-medium"
      />
      {status.kind === "reading" && <p className="mt-2 text-sm text-muted">{status.text ?? "Reading…"}</p>}
      {status.kind === "done" && <p className="mt-2 text-sm">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </div>
  );
}
