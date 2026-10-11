"use client";

import { useState } from "react";
import { readExportFile, summarize, type UsageSummary } from "@/lib/ai/exportParser";
import { WH_PER_AI_PROMPT } from "@/lib/factors";

const NAMES = { chatgpt: "ChatGPT", claude: "Claude" } as const;

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

/** Reads ChatGPT or Claude data exports in the browser and measures AI use. */
export function AiExportUpload({ onResult }: { onResult: (s: UsageSummary) => void }) {
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({
    kind: "idle",
  });

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
      onResult(s);
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
      <p className="font-medium">Use your ChatGPT or Claude data export</p>
      <p className="mt-1 text-sm text-muted">
        In ChatGPT, go to Settings, Data controls, Export data. In Claude, go to Settings, Privacy, Export data. Add the
        .zip you get by email. We measure how much you use AI right in your browser; the file never leaves your device.
      </p>
      <input
        type="file"
        accept=".zip,.json,application/zip,application/json"
        multiple
        onChange={(e) => handle(e.target.files)}
        aria-label="ChatGPT or Claude data export"
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-medium file:text-accent"
      />
      {status.kind === "reading" && <p className="mt-2 text-sm text-muted">Reading…</p>}
      {status.kind === "done" && <p className="mt-2 text-sm text-accent">{status.text}</p>}
      {status.kind === "error" && <p className="mt-2 text-sm text-red-600">{status.text}</p>}
    </div>
  );
}
