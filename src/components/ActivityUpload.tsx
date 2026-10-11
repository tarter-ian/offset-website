"use client";

import { useEffect, useState } from "react";
import { activityAmounts, readActivityFile, SOURCE_NAMES, type ActivityAmounts, type ActivityEvent, type ActivitySource } from "@/lib/activity";

const UNITS: Record<keyof ActivityAmounts["amounts"], (n: number) => string> = {
  music: (n) => `${n} hours a day of music and podcasts`,
  video: (n) => `${n} hours a day of video`,
  car: (n) => `${n} miles a week by car`,
  transit: (n) => `${n} miles a week by bus and train`,
  flights: (n) => `${n} round trips a year`,
};

/** Reads Spotify, YouTube, Netflix and Google Maps downloads in the browser and fills in the matching tiles. */
export function ActivityUpload({
  onResult,
}: {
  onResult: (a: ActivityAmounts["amounts"], from: Partial<Record<keyof ActivityAmounts["amounts"], ActivitySource[]>>) => void;
}) {
  const [sources, setSources] = useState<Partial<Record<ActivitySource, ActivityEvent[]>>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({ kind: "idle" });
  // Services people can sign in to directly, through Reclaim, once its keys are set.
  const [signIns, setSignIns] = useState<ActivitySource[]>([]);
  useEffect(() => {
    fetch("/api/reclaim")
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((d) => setSignIns(d.services ?? []))
      .catch(() => {});
  }, []);

  function apply(next: Partial<Record<ActivitySource, ActivityEvent[]>>) {
    setSources(next);
    const result = activityAmounts(Object.values(next).flat());
    if (!result) {
      setStatus({ kind: "error", text: "We didn't find any listening, watching or travel history." });
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

  async function signIn(service: ActivitySource) {
    setStatus({ kind: "reading", text: `Waiting for you to sign in to ${SOURCE_NAMES[service]}…` });
    try {
      const start = await fetch("/api/reclaim/request", { method: "POST", body: JSON.stringify({ service }) });
      const session = await start.json();
      if (!start.ok) throw new Error(session.error);
      const { ReclaimProofRequest } = await import("@reclaimprotocol/js-sdk");
      const request = await ReclaimProofRequest.fromJsonString(session.config);
      await request.triggerReclaimFlow();
      await request.startSession({
        onSuccess: async (proofs) => {
          const res = await fetch("/api/reclaim/verify", {
            method: "POST",
            body: JSON.stringify({ service, proofs, token: session.token, version: session.version }),
          });
          const out = await res.json();
          if (!res.ok || !out.events?.length) {
            setStatus({ kind: "error", text: out.error ?? `We didn't find any history in your ${SOURCE_NAMES[service]} account.` });
            return;
          }
          apply({ ...sources, [service]: out.events });
        },
        onError: () => setStatus({ kind: "error", text: `The ${SOURCE_NAMES[service]} sign-in didn't finish. Try again, or add the download below.` }),
      });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error && e.message ? e.message : "We couldn't start the sign-in." });
    }
  }

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setStatus({ kind: "reading" });
    try {
      const found = (await Promise.all([...files].map(readActivityFile))).flat();
      if (!found.some((f) => f.events.length)) {
        setStatus({ kind: "error", text: "We couldn't find any listening, watching or travel history in that file." });
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
      {signIns.length > 0 && (
        <div className="mb-4">
          <p className="font-medium">Sign in to fill this in for you</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {signIns.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => signIn(s)}
                className="min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
              >
                {sources[s] ? `✓ ${SOURCE_NAMES[s]}` : SOURCE_NAMES[s]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">
            Signing in goes through Reclaim Protocol. Your password isn&apos;t shared with us, only your history.
          </p>
        </div>
      )}
      <p className="font-medium">{signIns.length ? "Or add" : "Add"} your Spotify, YouTube, Netflix or Google Maps history</p>
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
          about 12 minutes each.
        </li>
        <li>Netflix: Account, Download your personal information. Or the Viewing activity page&apos;s Download all.</li>
        <li>
          Google Maps: in the app, Settings, Location and privacy, Export Timeline data. This fills in driving, bus and
          train, and flights.
        </li>
      </ul>
      <p className="mt-1 text-sm text-muted">Add the .zip, .json or .csv. We read it in your browser; the file never leaves your device.</p>
      <input
        type="file"
        accept=".zip,.json,.csv,application/zip,application/json,text/csv"
        multiple
        onChange={(e) => handle(e.target.files)}
        aria-label="Spotify, YouTube, Netflix or Google Maps history"
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-2 file:border-rule file:bg-background file:px-3 file:py-2 file:font-medium"
      />
      {status.kind === "reading" && <p className="mt-2 text-sm text-muted">{status.text ?? "Reading…"}</p>}
      {status.kind === "done" && <p className="mt-2 text-sm">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </div>
  );
}
