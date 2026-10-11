"use client";

import { useState } from "react";
import { AiApiLink } from "./AiApiLink";
import { combineSummaries, readExportFile, summarize, type UsageSummary } from "@/lib/ai/exportParser";
import type { ApiProvider } from "@/lib/ai/usageApi";
import { WH_PER_AI_PROMPT } from "@/lib/factors";

const NAMES = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", "openai-api": "OpenAI API", "anthropic-api": "Anthropic API" } as const;

function describe(s: UsageSummary): string {
  const perPrompt = s.promptsPerDay > 0 ? s.whPerDay / s.promptsPerDay : 0;
  const times = perPrompt / WH_PER_AI_PROMPT;
  const parts = [
    `Found ${s.totalPrompts.toLocaleString("en-US")} prompts in your ${s.providers.map((p) => NAMES[p]).join(" and ")} export: about ${s.promptsPerDay.toFixed(1)} a day over the last ${s.windowDays} days.`,
    perPrompt > 0 &&
      `Each one used about ${perPrompt.toFixed(1)} Wh${times >= 1.5 ? `, ${Math.round(times)} times a short chat, because of long conversations${s.reasoningShare > 0.1 ? " and reasoning models" : ""}` : ""}.`,
    s.imagesPerWeek >= 0.1 && `You made about ${s.imagesPerWeek.toFixed(1)} images a week.`,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Reads ChatGPT, Claude or Gemini data exports in the browser and measures AI use. */
export function AiExportUpload({ onResult, showApi = true }: { onResult: (s: UsageSummary) => void; showApi?: boolean }) {
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({
    kind: "idle",
  });
  const [sources, setSources] = useState<Record<string, UsageSummary>>({});
  const [api, setApi] = useState<ApiProvider | null>(null);
  const add = (id: string, s: UsageSummary) => {
    const next = { ...sources, [id]: s };
    setSources(next);
    onResult(combineSummaries(Object.values(next))!);
  };

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setStatus({ kind: "reading" });
    try {
      const counts = (await Promise.all([...files].map(readExportFile))).filter((c) => c !== null);
      if (!counts.length) {
        setStatus({ kind: "error", text: "We couldn't find any conversations in that file." });
        return;
      }
      const s = summarize(counts);
      add("export", s);
      setStatus({
        kind: "done",
        text: describe(s),
      });
    } catch {
      setStatus({ kind: "error", text: "We couldn't read that file. Try the .zip exactly as you downloaded it." });
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-4">
      <p className="font-medium">Use your ChatGPT, Claude or Gemini data export</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
        <li>ChatGPT: Settings, Data controls, Export data.</li>
        <li>Claude: Settings, Privacy, Export data.</li>
        <li>
          Gemini: on{" "}
          <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="underline">
            Google Takeout
          </a>
          , deselect all, pick My Activity, choose only Gemini Apps, and set the format to JSON.
        </li>
      </ul>
      <p className="mt-1 text-sm text-muted">
        Add the .zip you get by email. We measure how much you use AI right in your browser; the file never leaves your
        device.
      </p>
      <input
        type="file"
        accept=".zip,.json,application/zip,application/json"
        multiple
        onChange={(e) => handle(e.target.files)}
        aria-label="ChatGPT, Claude or Gemini data export"
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-medium file:text-accent"
      />
      {status.kind === "reading" && <p className="mt-2 text-sm text-muted">Reading…</p>}
      {status.kind === "done" && <p className="mt-2 text-sm text-accent">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.text}</p>}
      {showApi && (
      <p className="mt-4 text-sm text-muted">
        Use AI through the API?{" "}
        {(["openai-api", "anthropic-api"] as const).map((p, i) => (
          <span key={p}>
            {i > 0 && " or "}
            <button type="button" onClick={() => setApi(p)} className="text-accent hover:underline">
              {sources[p] ? `✓ ${NAMES[p]}` : `Connect ${NAMES[p]}`}
            </button>
          </span>
        ))}
      </p>
      )}
      {api && (
        <div className="mt-3">
          <AiApiLink key={api} provider={api} onResult={(s) => add(api, s)} />
        </div>
      )}
    </div>
  );
}
