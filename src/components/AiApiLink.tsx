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
    <form onSubmit={submit} className="border-2 border-rule bg-card p-4">
      <p className="font-medium">Connect your {info.name}</p>
      <p className="mt-1 text-sm text-muted">
        Paste{" "}
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {info.keyHelp}
        </a>
        . It goes to our server once, which asks for your last 90 days of token totals and then drops it. We never
        save or log it. An admin key can do a lot, so delete it once you&apos;re done.
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
          className="min-w-0 flex-1 rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-sm focus:border-rule"
        />
        <button
          type="submit"
          disabled={!key || status.kind === "reading"}
          className="whitespace-nowrap rounded-md bg-foreground px-4 py-2 font-semibold text-background disabled:opacity-60"
        >
          {status.kind === "reading" ? "Reading…" : "Connect"}
        </button>
      </div>
      {status.kind === "done" && <p className="mt-2 text-sm">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
    </form>
  );
}
