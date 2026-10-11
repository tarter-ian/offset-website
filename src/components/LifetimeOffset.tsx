"use client";

import { useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Badge } from "./Badge";
import { Field, NumberInput } from "./fields";
import { WaitlistForm } from "./WaitlistForm";
import { IMPACT_KEYS } from "@/lib/footprint";
import { IMPACT_INFO } from "@/lib/impacts";
import {
  LIFETIME_COVERS,
  lifetimeOffset,
  type LifetimeCover,
  type LifetimeInput,
} from "@/lib/lifetime";
import { LIFETIME_MIN_DONATION_USD, usd } from "@/lib/pricing";

const DEFAULTS: LifetimeInput = {
  birthYear: 1995,
  streamingHoursPerDay: 2,
  aiPromptsPerDay: 10,
  aiMediaPerWeek: 0,
};

/** One-time offset for a lifetime of internet use, AI use or both, priced live as people answer. */
export function LifetimeOffset({
  initialCover = "both",
}: {
  initialCover?: LifetimeCover;
}) {
  const [input, setInput] = useState<LifetimeInput>(DEFAULTS);
  const [cover, setCover] = useState<LifetimeCover>(initialCover);
  const o = lifetimeOffset(input, cover);
  const showInternet = cover !== "ai";
  const showAi = cover !== "internet";
  const set = (patch: Partial<LifetimeInput>) =>
    setInput((i) => ({ ...i, ...patch }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <Field label="What do you want to cover?">
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="What to cover"
          >
            {(Object.keys(LIFETIME_COVERS) as LifetimeCover[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cover === c}
                onClick={() => setCover(c)}
                className={`rounded-lg border px-4 py-2 font-medium ${
                  cover === c
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-card hover:border-accent"
                }`}
              >
                {LIFETIME_COVERS[c].label} ·{" "}
                {usd(lifetimeOffset(input, c).total)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="What year were you born?">
          <NumberInput
            label="Birth year"
            min={1900}
            value={input.birthYear}
            onChange={(n) => set({ birthYear: n ?? DEFAULTS.birthYear })}
          />
        </Field>
        {showInternet && (
          <Field
            label="Hours of video a day"
            hint="YouTube, Netflix, TikTok and the like. Video is most of what we use the internet for."
          >
            <NumberInput
              label="Video hours a day"
              step={0.5}
              suffix="hours a day"
              value={input.streamingHoursPerDay}
              onChange={(n) => set({ streamingHoursPerDay: n ?? 0 })}
            />
          </Field>
        )}
        {showAi && (
          <>
            <AiExportUpload
              onResult={(s) =>
                set({
                  aiPromptsPerDay: Math.round(s.promptsPerDay * 10) / 10,
                  aiFromExport: true,
                })
              }
            />
            <Field label="AI chatbot prompts a day">
              <NumberInput
                label="AI prompts a day"
                suffix="prompts a day"
                value={input.aiPromptsPerDay}
                onChange={(n) =>
                  set({ aiPromptsPerDay: n ?? 0, aiFromExport: false })
                }
              />
            </Field>
            <Field label="AI images or videos made a week">
              <NumberInput
                label="AI images or videos a week"
                suffix="a week"
                value={input.aiMediaPerWeek}
                onChange={(n) => set({ aiMediaPerWeek: n ?? 0 })}
              />
            </Field>
          </>
        )}
      </div>

      <aside className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-4">
          <Badge
            area={LIFETIME_COVERS[cover].badge}
            detail="for life"
            size="sm"
          />
          <div>
            <div className="text-sm text-muted">One payment, for life</div>
            <div className="text-3xl font-semibold">{usd(o.total)}</div>
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Donation to charities</dt>
            <dd>{usd(o.donation)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Our one-time fee</dt>
            <dd>{usd(o.fee)}</dd>
          </div>
        </dl>
        <div className="border-t border-border pt-4 text-sm">
          <p className="font-medium">What it covers</p>
          <p className="mt-1 text-muted">
            {[
              showInternet &&
                `${Math.round(o.pastYears.internet)} years online so far`,
              showAi && `${o.pastYears.ai.toFixed(1)} years of AI chat`,
              `${Math.round(o.futureYears)} years to come`,
            ]
              .filter(Boolean)
              .join(", ")}
            .
            {showAi &&
              " Future AI use is counted three times over in case it grows."}
            {o.donation === LIFETIME_MIN_DONATION_USD &&
              ` The math comes to less than ${usd(LIFETIME_MIN_DONATION_USD)}, so we round up to it.`}
          </p>
          <ul className="mt-3 space-y-1">
            {IMPACT_KEYS.filter((k) => o.impacts[k] > 0).map((k) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted">{IMPACT_INFO[k].label}</span>
                <span>{IMPACT_INFO[k].format(o.impacts[k])}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm text-muted">
            Payments open soon. Join the waitlist to be first in line.
          </p>
          <WaitlistForm />
        </div>
      </aside>
    </div>
  );
}
