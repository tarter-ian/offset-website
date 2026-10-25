"use client";

import { useEffect, useRef, useState } from "react";
import { AI_LEVELS, type AiLevel } from "@/lib/ai/levels";
import { AGENT_TOOL_NAMES, claudeLimitWhPerDay, signInUsage, summaryFromSignIn, type SignInUsage } from "@/lib/ai/signin";
import { CLAUDE_PLANS, usageFromQuickCount, type ClaudePlan, type QuickService } from "@/lib/ai/quickCount";
import { combineSummaries, type UsageSummary } from "@/lib/ai/exportParser";
import { activityAmounts, amazonShopping, NETFLIX_MIN_PER_TITLE, youtubeDays } from "@/lib/activity";
import { canInstallExtension, detectExtension, isPhone, EXTENSION_SERVICES, EXTENSION_URL, measure, measuredAtOf, savedResults, type ExtensionError, type ExtensionService, type SavedResult } from "@/lib/extension";
import { SIGN_IN_READS } from "@/lib/signinReads";
import { AiPhoneExport } from "./AiPhoneExport";
import {
  combinePast,
  combineVideoPast,
  deliveryPast,
  monthName,
  ridePast,
  usdSpend,
  videoHistoryHours,
  type CardPast,
  type HistoryTotal,
  type VideoPast,
} from "@/lib/history";

const AI_NAMES: Record<QuickService, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };
const SERVICES = Object.keys(AI_NAMES) as QuickService[];
const EXT_NAMES: Record<ExtensionService, string> = {
  ...AI_NAMES,
  youtube: "YouTube",
  netflix: "Netflix",
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  amazon: "Amazon",
  uber: "Uber",
};
type FoodService = "doordash" | "ubereats";
/** "Measure everything" reuses a result counted this recently instead of counting again. */
const REUSE_HOURS = 24;
/** Saved results older than this are re-counted in the background when the page opens. */
const REFRESH_DAYS = 7;
const ERRORS: Record<ExtensionError, (name: string) => string> = {
  "signed-out": (n) => `You're not logged in to ${n} in this browser.`,
  closed: () => "The tab was closed before it finished.",
  timeout: () => "It took too long.",
  "reload-page": () => "The extension was updated since this page opened.",
  denied: (n) => `You didn't allow it on ${n}, so nothing was counted.`,
  unavailable: () => "Couldn't count this one.",
};

/** `raw` is exactly what the extension handed over, shown on request so people can check it holds only counts. */
type Row = { state: "asking" | "counting" | "done" | "incomplete" | "error" | "skipped"; text?: string; error?: ExtensionError; raw?: unknown };

/**
 * Sizing AI use. One click: pick light, medium or heavy. Exact: the Offset
 * extension counts the last 30 days in a tab where you're already logged in.
 * Phones can't run it, so there the data export is the way in, read on the
 * phone; counting the chats in your sidebar covers the wait for its email.
 * Elsewhere without the extension (Safari, Firefox): count the chats yourself,
 * with the data export for a full history.
 */
export function AiQuickPick({
  level,
  keepGuess = false,
  onPick,
  onExact,
  onMeasured,
  onVideo,
  onDelivery,
  onDeliveryPast,
  onVideoPast,
  onRides,
  onRidesPast,
  onShopping,
  hideLevels = false,
}: {
  level: AiLevel | null;
  /** Light, Medium or Heavy was picked: counts saved from an earlier visit are shown but don't replace the pick (Ian, 2026-10-13). */
  keepGuess?: boolean;
  onPick: (level: AiLevel, from: string) => void;
  /** Light, Medium and Heavy are shown elsewhere (the home page's price box), so only Connect shows here. */
  hideLevels?: boolean;
  onExact: () => void;
  /** A summary of real use. `note` is set when it's the person's own count rather than a measurement. */
  onMeasured: (s: UsageSummary, note?: string) => void;
  /** Hours a day of video, measured from YouTube by the extension. */
  onVideo?: (hoursPerDay: number, from: ("youtube" | "netflix")[]) => void;
  /** Ride-hailing miles a week, measured from Uber. */
  onRides?: (milesPerWeek: number) => void;
  /** Dollars a month per shopping card, from Amazon spending by kind. */
  onShopping?: (usdPerMonth: ReturnType<typeof amazonShopping>) => void;
  /** Deliveries a week, measured from DoorDash and Uber Eats together. */
  onDelivery?: (perWeek: number) => void;
  /** Deliveries to date, from DoorDash and Uber Eats orders by month. */
  onDeliveryPast?: (past: CardPast | undefined) => void;
  /** Ride miles to date, from Uber rides by month. */
  onRidesPast?: (past: CardPast | undefined) => void;
  /** Video hours watched to date, from YouTube and Netflix whole history. */
  onVideoPast?: (past: VideoPast | undefined) => void;
}) {
  const [ext, setExt] = useState<string | null>(null);
  const [rows, setRows] = useState<Partial<Record<ExtensionService, Row>>>({});
  /** When each service's shown result was measured, from the extension's saved results or a fresh count. */
  const [measuredAt, setMeasuredAt] = useState<Partial<Record<ExtensionService, string>>>({});
  const [, setVideo] = useState<Partial<Record<"youtube" | "netflix", number>>>({});
  const [, setVideoPast] = useState<Partial<Record<"youtube" | "netflix", HistoryTotal | null>>>({});
  /** Read each account's whole history, not just 30 days. Slower, so off unless asked for. */
  const [whole, setWhole] = useState(false);
  const [, setFood] = useState<Partial<Record<FoodService, number>>>({});
  const [, setFoodPast] = useState<Partial<Record<FoodService, CardPast | null>>>({});
  const [aiSummaries, setAiSummaries] = useState<Partial<Record<QuickService, UsageSummary>>>({});
  const summariesRef = useRef<Partial<Record<QuickService, UsageSummary>>>({});
  // Read at the moment saved counts arrive, after the page has restored the person's last pick.
  const keepGuessRef = useRef(keepGuess);
  keepGuessRef.current = keepGuess;
  const [installable, setInstallable] = useState(false);
  const [phone, setPhone] = useState(false);
  const [open, setOpen] = useState<QuickService | null>(null);
  /** The ways to count real use open from "Connect your data", or by themselves once there are counts to show. */
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "waiting" | "done" | "error"; text?: string; service?: QuickService }>({ kind: "idle" });

  useEffect(() => {
    setInstallable(canInstallExtension());
    setPhone(isPhone());
    detectExtension().then((v) => {
      setExt(v);
      if (!v) return;
      // Show what the extension saved last time straight away, and quietly re-count anything older than a week.
      savedResults().then((saved) => {
        const stale: ExtensionService[] = [];
        for (const [service, r] of Object.entries(saved) as [ExtensionService, SavedResult][]) {
          applyUsage(service, r.usage, r.measuredAt, true);
          if (Date.now() - Date.parse(r.measuredAt) > REFRESH_DAYS * 86400000) stale.push(service);
        }
        if (stale.length) run(stale);
      });
    });
    // Runs once on load; applyUsage and run only read state through setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /** Puts one service's counts on its row and the cards it fills. */
  function applyUsage(service: ExtensionService, usage: unknown, at?: string, saved = false) {
    setMeasuredAt((m) => ({ ...m, [service]: at ?? new Date().toISOString() }));
    if (service === "doordash" || service === "ubereats") {
      const d = deliveries(usage);
      if (!d) {
        setRows((r) => ({ ...r, [service]: { state: "error", error: "unavailable", raw: usage } }));
        return;
      }
      setRows((r) => ({
        ...r,
        [service]: {
          state: "done",
          raw: usage,
          text: `${plural(d.deliveries, "delivery", "deliveries")}${d.pickups ? `, ${plural(d.pickups, "pickup")}` : ""}${spentText(usage)} in ${d.days} days`,
        },
      }));
      reportFood(service, (d.deliveries / d.days) * 7);
      reportFoodPast(service, deliveryPast(usage));
      return;
    }
    if (service === "youtube") {
      const days = youtubeDays(usage);
      const video = activityAmounts(days)?.amounts.video;
      const totals = youtubeTotals(usage);
      const ever = videoHistoryHours("youtube", usage);
      setRows((r) => ({
        ...r,
        youtube: video
          ? {
              state: "done",
              raw: usage,
              text: `${totals.videos.toLocaleString("en-US")} videos and ${totals.shorts.toLocaleString("en-US")} Shorts in 30 days, about ${video} hours a day${everText(ever)}`,
            }
          : { state: "error", error: "unavailable", raw: usage },
      }));
      if (video) reportVideo("youtube", video);
      reportVideoPast("youtube", ever);
      return;
    }
    if (service === "netflix") {
      const n = countOver(usage, "titles");
      if (!n) {
        setRows((r) => ({ ...r, netflix: { state: "error", error: "unavailable", raw: usage } }));
        return;
      }
      const hours = (n.total / n.days) * (NETFLIX_MIN_PER_TITLE / 60);
      const ever = videoHistoryHours("netflix", usage);
      setRows((r) => ({
        ...r,
        netflix: { state: "done", raw: usage, text: `${plural(n.total, "episode or film", "episodes and films")} in ${n.days} days, ${hours < 0.1 ? "under 0.1" : `about ${hours.toFixed(1)}`} hours a day${everText(ever)}` },
      }));
      reportVideo("netflix", hours);
      reportVideoPast("netflix", ever);
      return;
    }
    if (service === "uber") {
      const m = countOver(usage, "miles");
      const rides = Number((usage as Record<string, unknown>)?.rides) || 0;
      if (!m) {
        setRows((r) => ({ ...r, uber: { state: "error", error: "unavailable", raw: usage } }));
        return;
      }
      setRows((r) => ({ ...r, uber: { state: "done", raw: usage, text: `${plural(rides, "ride")}, ${Math.round(m.total)} miles${spentText(usage)} in ${m.days} days` } }));
      onRides?.(Math.round((m.total / m.days) * 7));
      onRidesPast?.(ridePast(usage) ?? undefined);
      return;
    }
    if (service === "amazon") {
      const o = countOver(usage, "orders");
      const u = (usage ?? {}) as Record<string, unknown>;
      const items = Number(u.items) || 0;
      const spend = Number(u.spend);
      const spent = Number.isFinite(spend) ? `, $${Math.round(spend).toLocaleString("en-US")}` : "";
      setRows((r) => ({
        ...r,
        amazon: o
          ? { state: "done", raw: usage, text: `${o.total} orders, ${items} items${spent} in ${o.days} days` }
          : { state: "error", error: "unavailable", raw: usage },
      }));
      if (o && u.spendByKind) onShopping?.(amazonShopping(u.spendByKind, o.days));
      return;
    }
    const u = signInUsage(usage);
    if (!u) {
      setRows((r) => ({ ...r, [service]: { state: "error", error: "unavailable", raw: usage } }));
      return;
    }
    if (u.missedChats) {
      // A short count would under-price the offset, so it isn't used.
      const missed = u.missedChats > 0 ? `${u.missedChats.toLocaleString("en-US")} chats` : "some chats";
      const text = `${EXT_NAMES[service]} only let me read part of your history so far (${missed} skipped), so I haven't used this count yet. Measure again later and it carries on from where it stopped.`;
      setRows((r) => ({ ...r, [service]: { state: "incomplete", text, raw: usage } }));
      return;
    }
    setRows((r) => ({ ...r, [service]: { state: "done", text: resultText(u), raw: usage } }));
    // Combined outside the state updater, so the page isn't updated while this one renders.
    summariesRef.current = { ...summariesRef.current, [service]: summaryFromSignIn(service, u) };
    setAiSummaries(summariesRef.current);
    const all = combineSummaries(Object.values(summariesRef.current) as UsageSummary[]);
    if (all && !(saved && keepGuessRef.current)) onMeasured(all);
  }

  function run(services: ExtensionService[], inFront = false, then?: () => void, maxAgeHours?: number) {
    setStatus({ kind: "idle" });
    setOpen(null);
    setRows((r) => ({ ...r, ...Object.fromEntries(services.map((x) => [x, { state: "counting" }])) }));
    measure(
      services,
      {
        onUsage: (service, usage) => applyUsage(service, usage, measuredAtOf(usage)),
        onError: (service, error) => setRows((r) => ({ ...r, [service]: { state: "error", error } })),
        onAsking: (asked) => setRows((r) => ({ ...r, ...Object.fromEntries(asked.map((x) => [x, { state: "asking" }])) })),
        onCounting: (allowed) => setRows((r) => ({ ...r, ...Object.fromEntries(allowed.map((x) => [x, { state: "counting" }])) })),
        onProgress: (service, usage) => {
          const text = progressText(usage);
          if (text) setRows((r) => (r[service]?.state === "counting" ? { ...r, [service]: { state: "counting", text } } : r));
        },
        onDone: then,
      },
      inFront,
      maxAgeHours,
      whole,
    );
  }

  /** Video hours from YouTube and Netflix add up on the one video card. */
  function reportVideo(service: "youtube" | "netflix", hoursPerDay: number) {
    setVideo((prev) => {
      const next = { ...prev, [service]: hoursPerDay };
      const total = Object.values(next).reduce((s, n) => s + (n ?? 0), 0);
      onVideo?.(Math.round(total * 20) / 20, Object.keys(next) as ("youtube" | "netflix")[]);
      return next;
    });
  }

  /** Whole-history video hours from YouTube and Netflix add up as the video card's past use. */
  function reportVideoPast(service: "youtube" | "netflix", ever: HistoryTotal | null) {
    setVideoPast((prev) => {
      const next = { ...prev, [service]: ever };
      onVideoPast?.(combineVideoPast(Object.values(next)));
      return next;
    });
  }

  function reportFood(service: FoodService, perWeek: number) {
    setFood((prev) => {
      const next = { ...prev, [service]: perWeek };
      const week = Object.values(next).reduce((s, n) => s + (n ?? 0), 0);
      onDelivery?.(Math.round(week * 10) / 10);
      return next;
    });
  }

  /** Deliveries to date from DoorDash and Uber Eats add up as the delivery card's past use. */
  function reportFoodPast(service: FoodService, past: CardPast | null) {
    setFoodPast((prev) => {
      const next = { ...prev, [service]: past };
      onDeliveryPast?.(combinePast(Object.values(next)));
      return next;
    });
  }

  /** The extension brings each service's tab to the front to log in, counts once you have, and comes back here. */
  const logIn = ([first, ...rest]: ExtensionService[]) => first && run([first], true, rest.length ? () => logIn(rest) : undefined);

  /** Someone who doesn't use a service: nothing to count, and for food delivery that's zero orders. */
  function skip(x: ExtensionService) {
    setRows((r) => ({ ...r, [x]: { state: "skipped" } }));
    if (x === "doordash" || x === "ubereats") {
      reportFood(x, 0);
      reportFoodPast(x, null);
    }
    if (x === "uber") {
      onRides?.(0);
      onRidesPast?.(undefined);
    }
  }

  const signedOut = EXTENSION_SERVICES.filter((x) => rows[x]?.state === "error" && rows[x]?.error === "signed-out");
  const busy = Object.values(rows).some((r) => r?.state === "counting" || r?.state === "asking");

  const lastMeasured = Object.values(measuredAt).sort().at(-1);
  const counted = EXTENSION_SERVICES.filter((x) => rows[x]?.state === "done").length;

  const showConnect = connecting || Object.keys(rows).length > 0 || open !== null || status.kind !== "idle";
  // Only one button looks picked: Connect while counted numbers are in use, not after a level replaces them (Ian, 2026-10-13).
  const connectOn = showConnect && level === null;

  function connect(service: QuickService) {
    setOpen(open === service ? null : service);
  }

  return (
    <div>
      <div className={hideLevels ? "max-w-xs" : "grid grid-cols-2 gap-2 sm:grid-cols-4"} role="group" aria-label="How much you use AI">
        {(hideLevels ? [] : (Object.keys(AI_LEVELS) as AiLevel[])).map((k) => {
          const l = AI_LEVELS[k];
          const on = level === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(k, `you picked ${l.label.toLowerCase()}`)}
              className={`min-h-14 cursor-pointer rounded-md border-2 border-rule px-3 py-2 text-left ${on ? "bg-foreground text-background" : "hover:bg-card"}`}
            >
              <span className="block font-semibold">{l.label}</span>
              <span className={`block text-sm ${on ? "opacity-80" : "text-muted"}`}>{l.promptsPerDay} prompts a day</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={showConnect}
          aria-pressed={connectOn}
          onClick={() => {
            setConnecting(true);
            // Counts already here (saved, or from earlier this visit) replace a Light/Medium/Heavy pick straight away,
            // without waiting on a fresh count that may still be running (Ian, 2026-10-13).
            const known = combineSummaries(Object.values(summariesRef.current) as UsageSummary[]);
            if (known) onMeasured(known);
            // With the extension there's nothing to choose: every click updates the numbers (Ian, 2026-10-13).
            if (ext && !busy) run(EXTENSION_SERVICES, false, undefined, REUSE_HOURS);
          }}
          className={`min-h-14 cursor-pointer rounded-md border-2 border-rule px-3 py-2 text-left ${connectOn ? "bg-foreground text-background" : "hover:bg-card"}`}
        >
          <span className="block font-semibold">Connect your data</span>
          {ext && (busy || lastMeasured) && (
            <span className={`block text-sm ${connectOn ? "opacity-80" : "text-muted"}`}>
              {busy ? "Counting…" : `Updated ${ago(lastMeasured!)}`}
            </span>
          )}
        </button>
      </div>
      {showConnect && (
        <div className="mt-4">
      {ext ? (
        <div className="mt-2">
          {signedOut.length > 0 && !busy && (
            <div className="mt-3 border-2 border-rule p-3 text-sm">
              <p className="font-semibold">
                {signedOut.length === 1
                  ? `Log in to ${EXT_NAMES[signedOut[0]]} to count it`
                  : `${signedOut.length} to log in to before I can count them`}
              </p>
              <p className="mt-1 text-muted">
                The extension brings each one to the front. Log in there and it counts, then brings you back here. If you don&apos;t use
                one, say so and I&apos;ll leave it out.
              </p>
              <ul className="mt-2 space-y-2">
                {signedOut.map((x) => (
                  <li key={x} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => logIn([x])}
                      className="min-h-10 rounded-md border-2 border-rule px-3 font-semibold hover:bg-foreground hover:text-background"
                    >
                      Log in to {EXT_NAMES[x]}
                    </button>
                    <button type="button" onClick={() => skip(x)} className="underline hover:text-muted">
                      I don&apos;t use {EXT_NAMES[x]}
                    </button>
                  </li>
                ))}
              </ul>
              {signedOut.length > 1 && (
                <button type="button" onClick={() => logIn(signedOut)} className="mt-2 underline hover:text-muted">
                  Log in to all {signedOut.length}, one after another
                </button>
              )}
            </div>
          )}
          <details className="mt-1 text-sm">
            <summary className="min-h-10 cursor-pointer py-2 font-semibold underline underline-offset-4 hover:text-muted">
              Your numbers
              <span className="font-normal text-muted">
                {busy ? " · counting…" : counted ? ` · ${counted} ${counted === 1 ? "service" : "services"} counted` : ""}
              </span>
            </summary>
          {Object.keys(rows).length > 0 && (
            <dl className="mt-3 border-t-2 border-rule text-sm">
              {EXTENSION_SERVICES.filter((x) => rows[x]).map((x) => {
                const r = rows[x]!;
                return (
                  <div key={x} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b border-border py-2">
                    <dt className="font-semibold">{EXT_NAMES[x]}</dt>
                    <dd>
                      {r.state === "counting" && <span className="text-muted">{r.text ?? "Counting…"}</span>}
                      {r.state === "asking" && <span className="text-muted">Waiting for you to allow it in the My Offset window…</span>}
                      {r.state === "done" && (
                        <>
                          {r.text}
                          {measuredAt[x] && <span className="text-muted"> · measured {ago(measuredAt[x]!)}</span>}{" "}
                          <span className="whitespace-nowrap">
                            <button type="button" onClick={() => run([x])} disabled={busy} className="underline hover:text-muted disabled:opacity-60">
                              Count again
                            </button>
                          </span>
                        </>
                      )}
                      {r.state === "skipped" && (
                        <span>
                          <span className="text-muted">Left out: you don&apos;t use it.</span>{" "}
                          <button type="button" onClick={() => run([x])} disabled={busy} className="underline hover:text-muted disabled:opacity-60">
                            Count it
                          </button>
                        </span>
                      )}
                      {r.state === "incomplete" && (
                        <span>
                          <span className="text-muted">{r.text}</span>{" "}
                          <button type="button" onClick={() => run([x])} className="underline hover:text-muted">
                            Try again
                          </button>
                        </span>
                      )}
                      {r.state === "error" && (
                        <span>
                          <span className="text-muted">{ERRORS[r.error ?? "unavailable"](EXT_NAMES[x])}</span>{" "}
                          {r.error === "reload-page" ? (
                            <button type="button" onClick={() => window.location.reload()} className="underline hover:text-muted">
                              Refresh page
                            </button>
                          ) : (
                            r.error !== "signed-out" && (
                              <button type="button" onClick={() => run([x])} className="underline hover:text-muted">
                                {r.error === "denied" ? "Allow and count" : "Try again"}
                              </button>
                            )
                          )}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {EXTENSION_SERVICES.some((x) => rows[x]?.raw) && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer underline hover:text-muted">See exactly what the extension sent</summary>
              <p className="mt-2 text-muted">
                This is everything that came back, unedited. Counts and dates only: no chat text, no titles, no video names.
              </p>
              <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border p-3 font-mono text-xs">
                {JSON.stringify(
                  Object.fromEntries(EXTENSION_SERVICES.filter((x) => rows[x]?.raw).map((x) => [x, rows[x]!.raw])),
                  null,
                  2,
                )}
              </pre>
            </details>
          )}
          {Object.keys(aiSummaries).length > 0 && (
            <button
              type="button"
              onClick={() => {
                summariesRef.current = {};
                setAiSummaries({});
                setRows({});
                onPick("medium", "you removed your measured numbers, so I use medium");
              }}
              className="mt-2 text-sm underline hover:text-muted"
            >
              Remove these numbers
            </button>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted underline underline-offset-4 hover:text-foreground">Options and how it works</summary>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={whole} onChange={(e) => setWhole(e.target.checked)} disabled={busy} />
            <span>
              <span className="font-semibold">Count my whole history</span>{" "}
              <span className="text-muted">
                (slower). YouTube, Netflix and Gemini read back as far as your account goes, so your past use is measured instead of estimated. A long
                YouTube history can take 10 minutes or more. ChatGPT, Claude and the delivery apps always send their history.
              </span>
            </span>
          </label>
          <p className="mt-2 text-sm text-muted">
            The My Offset extension checks ChatGPT, Claude, Gemini, YouTube, Netflix, DoorDash, Uber Eats, Amazon and Uber in the background, where you&apos;re already logged in, and
            brings back your last 30 days. Only counts come back, never your chats or orders.{" "}
            <a href="/extension" className="underline hover:text-foreground">
              How it works
            </a>
          </p>
          </details>
          </details>
        </div>
      ) : phone ? (
        <AiPhoneExport
          onMeasured={(s) => {
            setStatus({ kind: "idle" });
            setOpen(null);
            onMeasured(s);
          }}
          onRemove={() => onPick("medium", "you removed your measured numbers, so I use medium")}
          onCount={(s) => setOpen(s)}
        />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => connect(s)}
                aria-expanded={open === s}
                className={`min-h-11 rounded-md border-2 border-rule px-4 font-semibold ${open === s ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background"}`}
              >
                Connect {AI_NAMES[s]}
              </button>
            ))}
          </div>
          {!open && (
            <p className="mt-2 text-sm text-muted">
              {installable
                ? "Exact numbers with the free My Offset extension, or count your chats yourself in under a minute."
                : "Count your chats yourself in under a minute, no login needed."}
            </p>
          )}
        </>
      )}

        </div>
      )}
      {open && (
        <div className="mt-3 border-2 border-rule p-4">
          {installable && !ext && <ExtensionOffer name={AI_NAMES[open]} service={open} />}
          <QuickCountForm
            key={open}
            service={open}
            withHeading={installable && !ext}
            onDone={(u, note) => {
              setOpen(null);
              setStatus({ kind: "done", service: open, text: `${note[0].toUpperCase()}${note.slice(1)}.` });
              onMeasured(summaryFromSignIn(open, u), note);
            }}
          />
          {!phone && (
          <p className="mt-3 text-sm text-muted">
            Want your full history?{" "}
            <button type="button" onClick={onExact} className="underline hover:text-foreground">
              Add your {AI_NAMES[open]} data export
            </button>
            .
          </p>
          )}
        </div>
      )}

      {status.kind === "waiting" && <p className="mt-2 text-sm text-muted">{status.text}</p>}
      {status.kind === "done" && (
        <div className="mt-2 border-l-2 border-rule pl-3 text-sm">
          <p>{status.text}</p>
          <button
            type="button"
            onClick={() => {
              const name = AI_NAMES[status.service ?? "chatgpt"];
              setStatus({ kind: "idle" });
              onPick("medium", `you removed your ${name} numbers, so I use medium`);
            }}
            className="mt-1 underline hover:text-muted"
          >
            Remove these numbers
          </button>
        </div>
      )}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </div>
  );
}

/** A total from the extension (like `miles` or `titles`) and the days it covers. */
/** "About 1,200 prompts so far (read 18 of 42 chats)…" from a running estimate. */
function progressText(usage: unknown): string | null {
  if (typeof usage !== "object" || !usage) return null;
  const u = usage as Record<string, unknown>;
  const prompts = Number(u.prompts);
  const read = Number(u.chatsRead);
  const total = Number(u.chatsTotal);
  if (!Number.isFinite(prompts) || !(total > 0) || !Number.isFinite(read)) return null;
  return `About ${Math.round(prompts).toLocaleString("en-US")} prompts so far (read ${read} of ${total} chats). Still counting; I price only the final figure.`;
}

/** "just now", "3 hours ago", "2 days ago". */
function ago(iso: string): string {
  const h = (Date.now() - Date.parse(iso)) / 3600000;
  if (!Number.isFinite(h) || h < 1) return "just now";
  if (h < 24) return `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function countOver(usage: unknown, key: string): { total: number; days: number } | null {
  if (typeof usage !== "object" || !usage) return null;
  const u = usage as Record<string, unknown>;
  const total = Number(u[key]);
  return Number.isFinite(total) ? { total, days: Number(u.windowDays) || 30 } : null;
}

/** DoorDash or Uber Eats counts from the extension: deliveries and pickups over its window. */
function deliveries(usage: unknown): { deliveries: number; pickups: number; days: number } | null {
  if (typeof usage !== "object" || !usage) return null;
  const u = usage as Record<string, unknown>;
  const d = Number(u.deliveries);
  if (!Number.isFinite(d)) return null;
  return { deliveries: d, pickups: Number(u.pickups) || 0, days: Number(u.windowDays) || 30 };
}

function youtubeTotals(usage: unknown): { videos: number; shorts: number } {
  const daily = typeof usage === "object" && usage && Array.isArray((usage as { daily?: unknown }).daily) ? (usage as { daily: Record<string, unknown>[] }).daily : [];
  return daily.reduce<{ videos: number; shorts: number }>(
    (t, d) => ({ videos: t.videos + (Number(d.videos) || 0), shorts: t.shorts + (Number(d.shorts) || 0) }),
    { videos: 0, shorts: 0 },
  );
}

/** ", and 4,434 hours since March 2022" after a whole-history count. */
const everText = (ever: HistoryTotal | null) =>
  ever ? `, and ${Math.round(ever.total).toLocaleString("en-US")} hours ${ever.whole ? "since" : "back to at least"} ${monthName(ever.firstMonth)}` : "";

/** One short line per AI service. How coding is estimated lives in the Coding with AI card's (i). */
function resultText(u: SignInUsage): string {
  const agent: Record<keyof typeof AGENT_TOOL_NAMES, string> = { agent: "agent", codex: "Codex", both: "agent and Codex" };
  return (
    `${u.prompts.toLocaleString("en-US")} prompts${u.images ? `, ${u.images} images` : ""} in ${u.days} days` +
    (u.promptsEver ? `, ${u.promptsEver.total.toLocaleString("en-US")} since ${monthName(u.promptsEver.since)}` : "") +
    (claudeLimitWhPerDay(u) > 0 ? ` · ${Math.round(u.weeklyLimitUsedPercent!)}% of weekly limit (the extra is on Coding with AI)` : "") +
    (u.agentTokens ? ` · ${millions(u.agentTokens.lifetime)} ${agent[u.agentTokens.tool]} tokens to date (on Coding with AI)` : "")
  );
}

/** ", $142" when the extension sent what the orders or rides cost in dollars (0.20.0 on). */
const spentText = (usage: unknown) => {
  const usd = usdSpend(usage);
  return usd === null ? "" : `, $${Math.round(usd).toLocaleString("en-US")}`;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const millions = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })} million` : n.toLocaleString("en-US"));

function ExtensionOffer({ name, service }: { name: string; service: QuickService }) {
  return (
    <div className="mb-4 border-b border-border pb-4">
      <p className="font-display text-lg font-bold">Exact numbers in one click</p>
      <p className="mt-1 text-sm">
        Add the free My Offset extension to Chrome or Edge. Then Connect {name} counts your last 30 days in a few seconds, in a tab where
        you&apos;re already logged in. It reads: {SIGN_IN_READS[service]}
      </p>
      <p className="mt-2 text-sm text-muted">
        It installs with no access to any site. The first time you measure {name}, it asks, and Chrome adds its standard line that it can
        &ldquo;read and change your data&rdquo; there. My Offset only counts, changes nothing, and runs only when you press the button. After
        each run you can see exactly what it sent.{" "}
        <a href="/extension" className="underline hover:text-foreground">
          How it works
        </a>
      </p>
      {EXTENSION_URL ? (
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-90"
        >
          Add to Chrome, free
        </a>
      ) : (
        <p className="mt-2 text-sm text-muted">The extension is on its way to the Chrome Web Store.</p>
      )}
    </div>
  );
}

function QuickCountForm({
  service,
  withHeading,
  onDone,
}: {
  service: QuickService;
  withHeading: boolean;
  onDone: (u: SignInUsage, note: string) => void;
}) {
  const name = AI_NAMES[service];
  const [chats, setChats] = useState("");
  const [plan, setPlan] = useState<ClaudePlan>("pro");
  const [pct, setPct] = useState("");
  const n = Number(chats);
  const ok = chats !== "" && Number.isFinite(n) && n >= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const u = usageFromQuickCount({
      chatsPerWeek: n,
      ...(service === "claude" ? { plan, weeklyLimitUsedPercent: Number(pct) || 0 } : {}),
    });
    const limit = claudeLimitWhPerDay(u);
    onDone(
      u,
      `from your count: ${n} ${name} chats a week, about ${u.prompts} prompts` +
        (limit > 0 ? `, and ${Math.round(u.weeklyLimitUsedPercent!)}% of your weekly limit (about ${(limit / 1000).toFixed(1)} kWh a day)` : ""),
    );
  }

  return (
    <form onSubmit={submit}>
      {withHeading && <p className="font-display text-lg font-bold">Or count it yourself</p>}
      <label className="mt-1 block text-sm">
        <span className="block">
          Open {name} and count the chats in your sidebar from the last 7 days (under Today, Yesterday and Previous 7 days).
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={chats}
          onChange={(e) => setChats(e.target.value)}
          placeholder="Chats"
          className="mt-2 min-h-11 w-32 rounded-md border-2 border-border bg-background px-3 focus:border-rule"
        />
      </label>
      {service === "claude" && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="block">Your Claude plan</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as ClaudePlan)}
              className="mt-2 min-h-11 w-full rounded-md border-2 border-border bg-background px-3 focus:border-rule"
            >
              {(Object.keys(CLAUDE_PLANS) as ClaudePlan[]).map((p) => (
                <option key={p} value={p}>
                  {CLAUDE_PLANS[p]}
                </option>
              ))}
            </select>
          </label>
          {plan !== "free" && (
            <label className="block">
              <span className="block">Weekly limit used, in Settings &gt; Usage (counts Claude Code)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="%"
                className="mt-2 min-h-11 w-24 rounded-md border-2 border-border bg-background px-3 focus:border-rule"
              />
            </label>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={!ok}
        className="mt-3 min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        Use my count
      </button>
    </form>
  );
}
