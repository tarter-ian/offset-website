"use client";

import Link from "next/link";
import { useState } from "react";
import { AiApiLink } from "./AiApiLink";
import { AiExportUpload } from "./AiExportUpload";
import { Field, Select } from "./fields";
import { Results } from "./Results";
import { combineSummaries, digitalFromExport, type UsageSummary } from "@/lib/ai/exportParser";
import type { ApiProvider } from "@/lib/ai/usageApi";
import { STATE_OPTIONS, type StateCode } from "@/lib/data/states";
import { computeFootprint, DEFAULT_ANSWERS, type Answers } from "@/lib/footprint";
import { PROVIDERS } from "@/lib/providers";

type Status = "idle" | "open" | "linked" | "later";

/** Adds up AI use across linked exports; nothing linked means averages. */
function combined(summaries: UsageSummary[]) {
  const s = combineSummaries(summaries);
  return s ? digitalFromExport(s) : {};
}

/** Link-first sign-up: pick a state, link what you can, and averages fill the rest. */
export function ConnectAccounts() {
  const [state, setState] = useState<StateCode>(DEFAULT_ANSWERS.state);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [ai, setAi] = useState<Record<string, UsageSummary>>({});
  const [done, setDone] = useState(false);

  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    state,
    digital: { ...DEFAULT_ANSWERS.digital, ...combined(Object.values(ai)) },
  };

  if (done) {
    return <Results footprint={computeFootprint(answers)} answers={answers} onEdit={() => setDone(false)} />;
  }

  const linkedCount = Object.values(status).filter((s) => s === "linked").length;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Link your accounts</h1>
      <p className="mt-3 text-lg text-muted">
        Link what you can and we&apos;ll work out your footprint from it. Anything you skip uses averages for your state, and
        you can link it later.
      </p>

      <div className="mt-8">
        <Field label="Your state" hint="Sets how clean your electricity is.">
          <Select
            label="State"
            value={state}
            onChange={(v) => setState(v as StateCode)}
            options={STATE_OPTIONS.map((s) => ({ value: s.code, label: s.name }))}
          />
        </Field>
      </div>

      <ul className="mt-8 space-y-3">
        {PROVIDERS.map((p) => {
          const s = status[p.id] ?? "idle";
          return (
            <li key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted">{p.blurb}</div>
                </div>
                {s === "linked" ? (
                  <span className="shrink-0 font-medium text-accent">✓ Linked</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus((cur) => ({ ...cur, [p.id]: p.export || p.apiKey ? "open" : "later" }))}
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
                  >
                    Link
                  </button>
                )}
              </div>
              {s === "open" && p.export && (
                <div className="mt-4">
                  <AiExportUpload
                    showApi={false}
                    onResult={(r) => {
                      setAi((cur) => ({ ...cur, [p.id]: r }));
                      setStatus((cur) => ({ ...cur, [p.id]: "linked" }));
                    }}
                  />
                </div>
              )}
              {s === "open" && p.apiKey && (
                <div className="mt-4">
                  <AiApiLink
                    provider={p.id as ApiProvider}
                    onResult={(r) => {
                      setAi((cur) => ({ ...cur, [p.id]: r }));
                      setStatus((cur) => ({ ...cur, [p.id]: "linked" }));
                    }}
                  />
                </div>
              )}
              {s === "later" && (
                <p className="mt-3 text-sm text-muted">
                  Linking with your {p.name.toLowerCase()} opens at launch. Until then we&apos;ll use averages for your
                  state.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setDone(true)}
          className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong"
        >
          {linkedCount ? "See my footprint" : "Skip for now and see my estimate"}
        </button>
        <Link href="/estimate" className="text-sm text-muted hover:text-foreground">
          Prefer to answer a few questions instead?
        </Link>
      </div>
    </div>
  );
}
