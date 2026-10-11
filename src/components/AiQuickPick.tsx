"use client";

import { useEffect, useState } from "react";
import { AI_LEVELS, type AiLevel } from "@/lib/ai/levels";

const AI_NAMES: Record<string, string> = { chatgpt: "ChatGPT", claude: "Claude", perplexity: "Perplexity" };

/**
 * The quick way to size AI use: pick light, medium or heavy, or sign in and
 * we read your plan. The data export stays available for an exact count.
 */
export function AiQuickPick({
  level,
  onPick,
  onExact,
}: {
  level: AiLevel | null;
  onPick: (level: AiLevel, from: string) => void;
  onExact: () => void;
}) {
  const [signIns, setSignIns] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "waiting" | "error"; text?: string }>({ kind: "idle" });
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
      <p className="mt-3 text-sm text-muted">
        {signIns.length > 0 && (
          <>
            Or sign in and we&apos;ll go by your plan:{" "}
            {signIns.map((s, i) => (
              <span key={s}>
                {i > 0 && " · "}
                <button type="button" onClick={() => signIn(s)} className="font-medium text-foreground underline underline-offset-4">
                  {AI_NAMES[s] ?? s}
                </button>
              </span>
            ))}
            .{" "}
          </>
        )}
        Want it exact?{" "}
        <button type="button" onClick={onExact} className="font-medium text-foreground underline underline-offset-4">
          Add your ChatGPT, Claude or Gemini export
        </button>
        .
      </p>
      {status.kind === "waiting" && <p className="mt-2 text-sm text-muted">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </div>
  );
}
