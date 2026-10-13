"use client";

import { useState } from "react";
import { describeExport } from "./AiExportUpload";
import { combineSummaries, readExportFile, summarize, type AiProvider, type UsageSummary } from "@/lib/ai/exportParser";
import type { QuickService } from "@/lib/ai/quickCount";

const NAMES: Record<QuickService, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };

const STEPS: Record<QuickService, React.ReactNode[]> = {
  chatgpt: [
    "In the ChatGPT app, open Settings > Data controls > Export data.",
    "OpenAI emails you a link. Open it on this phone and download the .zip.",
    "Come back here and add it.",
  ],
  claude: [
    "In Claude, open Settings > Privacy > Export data.",
    "Anthropic emails you a link. Open it on this phone and download the .zip.",
    "Come back here and add it.",
  ],
  gemini: [
    <>
      On{" "}
      <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
        Google Takeout
      </a>
      , tap Deselect all, then pick My Activity.
    </>,
    "Under My Activity, choose only Gemini Apps and set the format to JSON.",
    "Google emails you a link. Download the .zip and add it here.",
  ],
};

/**
 * Phones can't run the extension, so "Connect your data" there measures from
 * the data export: the steps for each service and a place to add the .zip.
 * The file is read on the phone and never uploaded (Ian, 2026-10-13).
 */
export function AiPhoneExport({
  onMeasured,
  onRemove,
  onCount,
}: {
  onMeasured: (s: UsageSummary) => void;
  onRemove: () => void;
  /** Counting chats by hand, for while the export's email is on its way. */
  onCount: (service: QuickService) => void;
}) {
  const [service, setService] = useState<QuickService>("chatgpt");
  const [sources, setSources] = useState<Partial<Record<AiProvider, UsageSummary>>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "done" | "error"; text?: string }>({ kind: "idle" });

  async function handle(input: HTMLInputElement) {
    const files = [...(input.files ?? [])];
    input.value = "";
    if (!files.length) return;
    setStatus({ kind: "reading" });
    try {
      const found = (await Promise.all(files.map(readExportFile))).filter((u) => u !== null);
      if (!found.length) {
        setStatus({ kind: "error", text: "I couldn't find any chats in that file. Add the .zip exactly as you downloaded it." });
        return;
      }
      // One export per service; adding the same service again replaces it.
      const next = { ...sources };
      for (const u of found) next[u.provider] = summarize([u]);
      setSources(next);
      onMeasured(combineSummaries(Object.values(next))!);
      setStatus({ kind: "done", text: describeExport(summarize(found)) });
    } catch {
      setStatus({ kind: "error", text: "I couldn't read that file. Add the .zip exactly as you downloaded it." });
    }
  }

  return (
    <div className="mt-2 border-2 border-rule p-4">
      <p className="font-display text-lg font-bold">Measure it from your data export</p>
      <p className="mt-1 text-sm text-muted">It takes a few minutes. The file is read on this phone and never uploaded.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which AI">
        {(Object.keys(NAMES) as QuickService[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={service === s}
            onClick={() => setService(s)}
            className={`min-h-11 rounded-md border-2 border-rule px-4 font-semibold ${service === s ? "bg-foreground text-background" : "hover:bg-card"}`}
          >
            {sources[s] ? `✓ ${NAMES[s]}` : NAMES[s]}
          </button>
        ))}
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        {STEPS[service].map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <label className="mt-4 block text-sm font-semibold">
        Add your export
        <input
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          onChange={(e) => handle(e.currentTarget)}
          className="mt-2 block w-full text-sm font-normal file:mr-3 file:min-h-11 file:rounded-md file:border-2 file:border-rule file:bg-background file:px-3 file:font-semibold"
        />
      </label>
      <div aria-live="polite">
        {status.kind === "reading" && <p className="mt-2 text-sm text-muted">Reading…</p>}
        {status.kind === "done" && (
          <div className="mt-3 border-l-2 border-rule pl-3 text-sm">
            <p>{status.text}</p>
            <button
              type="button"
              onClick={() => {
                setSources({});
                setStatus({ kind: "idle" });
                onRemove();
              }}
              className="mt-1 underline hover:text-muted"
            >
              Remove these numbers
            </button>
          </div>
        )}
        {status.kind === "error" && <p className="mt-2 text-sm text-red-700">{status.text}</p>}
      </div>
      {status.kind !== "done" && (
        <p className="mt-4 text-sm text-muted">
          Waiting for the email?{" "}
          <button type="button" onClick={() => onCount(service)} className="underline underline-offset-4 hover:text-foreground">
            Count your {NAMES[service]} chats for now
          </button>
          .
        </p>
      )}
    </div>
  );
}
