"use client";

import { useEffect, useState } from "react";
import { AI_LEVELS, type AiLevel } from "@/lib/ai/levels";
import { claudeLimitWhPerDay, summaryFromSignIn, type SignInUsage } from "@/lib/ai/signin";
import type { UsageSummary } from "@/lib/ai/exportParser";
import { RECLAIM_URL, SIGN_IN_READS } from "@/lib/signinReads";

const AI_NAMES: Record<string, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };

/**
 * The quick way to size AI use: sign in to ChatGPT or Claude and we count
 * your last 30 days, or pick light, medium or heavy. The data export stays
 * available for Gemini and for a full history.
 */
export function AiQuickPick({
  level,
  onPick,
  onExact,
  onMeasured,
}: {
  level: AiLevel | null;
  onPick: (level: AiLevel, from: string) => void;
  onExact: () => void;
  onMeasured: (s: UsageSummary) => void;
}) {
  const [signIns, setSignIns] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "waiting" | "done" | "error"; text?: string; service?: string }>({ kind: "idle" });
  useEffect(() => {
    fetch("/api/reclaim")
      .then((r) => (r.ok ? r.json() : { ai: [] }))
      .then((d) => setSignIns(d.ai ?? []))
      .catch(() => {});
  }, []);

  async function signIn(service: string) {
    const name = AI_NAMES[service] ?? service;
    setStatus({ kind: "waiting", text: `Waiting for you to sign in to ${name}…` });
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
          if (res.ok && out.usage) {
            const u = out.usage as SignInUsage;
            setStatus({
              kind: "done",
              service,
              text:
                `From your ${name} account: ${u.prompts.toLocaleString("en-US")} prompts${u.images ? ` and ${u.images} images` : ""} in the last ${u.days} days.` +
                (claudeLimitWhPerDay(u) > 0
                  ? ` You've also used ${Math.round(u.weeklyLimitUsedPercent!)}% of your plan's weekly limit, which counts Claude Code, so we estimate from that: about ${(claudeLimitWhPerDay(u) / 1000).toFixed(1)} kWh a day.`
                  : ""),
            });
            onMeasured(summaryFromSignIn(service === "claude" || service === "gemini" ? service : "chatgpt", u));
            return;
          }
          if (!res.ok || !out.level) {
            setStatus({ kind: "error", text: out.error ?? `We couldn't see your ${name} plan. Pick a level instead.` });
            return;
          }
          setStatus({ kind: "idle" });
          onPick(out.level, `estimated from your ${name} ${String(out.plan).toLowerCase()} plan`);
        },
        onError: () => setStatus({ kind: "error", text: `The ${name} sign-in didn't finish. Try again, or pick a level.` }),
      });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error && e.message ? e.message : "We couldn't start the sign-in." });
    }
  }

  return (
    <div>
      <p className="font-semibold">How much do you use AI?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How much you use AI">
        {(Object.keys(AI_LEVELS) as AiLevel[]).map((k) => {
          const l = AI_LEVELS[k];
          const on = level === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(k, `you picked ${l.label.toLowerCase()}`)}
              className={`min-h-14 rounded-md border-2 px-3 py-2 text-left ${on ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"}`}
            >
              <span className="block font-semibold">{l.label}</span>
              <span className={`block text-sm ${on ? "opacity-80" : "text-muted"}`}>
                {l.who}, about {l.promptsPerDay} prompts
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 font-semibold">Or connect your account</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["chatgpt", "claude", "gemini"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => (signIns.includes(s) ? signIn(s) : onExact())}
            className="min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
          >
            Connect {AI_NAMES[s]}
          </button>
        ))}
      </div>
      {signIns.length ? (
        <div className="mt-2 text-sm text-muted">
          <p>
            You log in on the real site, through{" "}
            <a href={RECLAIM_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Reclaim Protocol
            </a>
            . Your password goes to that site, never to us. The counting happens in your browser, and only the counts reach us:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {(["chatgpt", "claude", "gemini"] as const).map((s) => (
              <li key={s}>
                <span className="font-medium text-foreground">{AI_NAMES[s]}:</span> {SIGN_IN_READS[s]}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Nothing is saved on our side.{" "}
            <a href="/data" className="underline hover:text-foreground">
              Your data
            </a>{" "}
            explains it all. Rather not log in? Picking a level above works just as well.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          You download your data from ChatGPT, Claude or Gemini and add it here. We count every prompt in your browser.
        </p>
      )}
      {status.kind === "waiting" && <p className="mt-2 text-sm text-muted">{status.text}</p>}
      {status.kind === "done" && (
        <div className="mt-2 border-l-2 border-rule pl-3 text-sm">
          <p>{status.text}</p>
          <button
            type="button"
            onClick={() => {
              const name = AI_NAMES[status.service ?? ""] ?? "account";
              setStatus({ kind: "idle" });
              onPick("medium", `you removed your ${name} numbers, so we use medium`);
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
