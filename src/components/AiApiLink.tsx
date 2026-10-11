"use client";

import { useState } from "react";
import type { UsageSummary } from "@/lib/ai/exportParser";
import { API_PROVIDERS, type ApiProvider } from "@/lib/ai/usageApi";
import { WH_PER_AI_PROMPT } from "@/lib/factors";

/** Links an OpenAI or Anthropic API organization with an admin key and reports measured use. */
export function AiApiLink({ provider, onResult }: { provider: ApiProvider; onResult: (s: UsageSummary) => void }) {
  const info = API_PROVIDERS[provider];
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "reading" });
    try {
      const res = await fetch("/api/ai-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const body = await res.json();
      setKey("");
      if (!res.ok) {
        setStatus({ kind: "error", text: body.error ?? "Something went wrong." });
        return;
      }
      const s = body as UsageSummary;
      onResult(s);
      setStatus({
        kind: "done",
        text: `Your ${info.name} used about ${s.whPerDay.toFixed(1)} Wh a day over the last ${s.windowDays} days, about the same as ${Math.round(
          s.whPerDay / WH_PER_AI_PROMPT,
        ).toLocaleString("en-US")} short chats.`,
      });
    } catch {
      setStatus({ kind: "error", text: "We couldn't reach the server. Try again." });
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-dashed border-border bg-card p-4">
      <p className="font-medium">Connect your {info.name}</p>
      <p className="mt-1 text-sm text-muted">
        Paste{" "}
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {info.keyHelp}
        </a>
        . We use it once to read your last 90 days of token totals, then forget it. We never save it, and you can
        delete the key as soon as you&apos;re done.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`key-${provider}`} className="sr-only">
          {info.name} admin key
        </label>
        <input
          id={`key-${provider}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={`${info.keyPrefix}…`}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent"
        />
        <button
          type="submit"
          disabled={!key || status.kind === "reading"}
          className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
        >
          {status.kind === "reading" ? "Reading…" : "Connect"}
        </button>
      </div>
      {status.kind === "done" && <p className="mt-2 text-sm text-accent">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.text}</p>}
    </form>
  );
}
