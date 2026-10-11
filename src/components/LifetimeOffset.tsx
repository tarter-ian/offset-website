"use client";

import { useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Badge } from "./Badge";
import { Field, NumberInput } from "./fields";
import { WaitlistForm } from "./WaitlistForm";
import { digitalFromExport } from "@/lib/ai/exportParser";
import { IMPACT_KEYS } from "@/lib/footprint";
import { IMPACT_INFO } from "@/lib/impacts";
import {
  DEFAULT_LIFETIME_INPUT,
  DEVICE_LABELS,
  INTERNET_ACTIVITIES,
  ITEM_KEYS,
  LIFETIME_ITEMS,
  lifetimeOffset,
  LIFETIME_MAX_USD,
  SPAN_CHOICE_ABOVE_USD,
  SPAN_KEYS,
  SPANS,
  type Span,
  type Device,
  type InternetActivity,
  type LifetimeInput,
  type LifetimeItem,
} from "@/lib/lifetime";
import { LIFETIME_MIN_DONATION_USD, MIN_DONATION_USD, usd } from "@/lib/pricing";

const badgeName = (items: LifetimeItem[]) =>
  items.length === ITEM_KEYS.length ? "Everything online" : items.map((k) => LIFETIME_ITEMS[k].label).join(" + ");

/** One-time offsets for a lifetime of internet use, AI use and devices, priced live as people answer. */
export function LifetimeOffset({ initialItems = ITEM_KEYS }: { initialItems?: LifetimeItem[] }) {
  const [input, setInput] = useState<LifetimeInput>(DEFAULT_LIFETIME_INPUT);
  const [items, setItems] = useState<LifetimeItem[]>(initialItems);
  const [spanChoice, setSpanChoice] = useState<Span>("lifetime");
  const [lifetimeAnyway, setLifetimeAnyway] = useState(false);
  // Only heavier users get past-only and monthly options; light users just see lifetime.
  const lifetimeTotal = lifetimeOffset(input, items).total;
  const showSpans = lifetimeTotal > SPAN_CHOICE_ABOVE_USD;
  const lifetimeOffered = lifetimeTotal <= LIFETIME_MAX_USD || lifetimeAnyway;
  const spans = SPAN_KEYS.filter((k) => k !== "lifetime" || lifetimeOffered);
  const span: Span = !showSpans ? "lifetime" : spans.includes(spanChoice) ? spanChoice : "monthly";
  const o = lifetimeOffset(input, items, undefined, span);
  const monthly = span === "monthly";
  const has = (k: LifetimeItem) => items.includes(k);
  const set = (patch: Partial<LifetimeInput>) => setInput((i) => ({ ...i, ...patch }));
  const toggle = (k: LifetimeItem) =>
    setItems((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : ITEM_KEYS.filter((x) => x === k || cur.includes(x))));

  const covered = monthly
    ? ["This month's use, approved by you each month"]
    : [
        (has("internet") || has("devices")) && `${Math.round(o.pastYears.internet)} years online so far`,
        has("ai") && `${o.pastYears.ai.toFixed(1)} years of AI chat`,
        span === "lifetime" && `${Math.round(o.futureYears)} years to come`,
      ].filter(Boolean);
  const minimum = monthly ? MIN_DONATION_USD : LIFETIME_MIN_DONATION_USD;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <Field label="What do you want to cover?" hint="Pick one or more. Each has its own badge.">
          <div className="flex flex-wrap gap-2">
            {ITEM_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={has(k)}
                onClick={() => toggle(k)}
                className={`rounded-lg border px-4 py-2 font-medium ${
                  has(k) ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent"
                }`}
              >
                {LIFETIME_ITEMS[k].label} · {usd(lifetimeOffset(input, [k], undefined, span).total)}
                {monthly ? "/mo" : ""}
              </button>
            ))}
          </div>
        </Field>

        {showSpans && (
          <Field
            label="How do you want to cover it?"
            hint={
              lifetimeOffered
                ? SPANS[span].hint
                : `${SPANS[span].hint} Lifetime isn't offered above $${LIFETIME_MAX_USD.toLocaleString("en-US")}, since most of it would be a guess about decades of future use.`
            }
          >
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How to cover it">
              {spans.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={span === k}
                  onClick={() => setSpanChoice(k)}
                  className={`rounded-lg border px-4 py-2 font-medium ${
                    span === k ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent"
                  }`}
                >
                  {SPANS[k].label} · {usd(lifetimeOffset(input, items, undefined, k).total)}
                  {k === "monthly" ? "/mo" : ""}
                </button>
              ))}
            </div>
            {!lifetimeOffered && (
              <button
                type="button"
                onClick={() => setLifetimeAnyway(true)}
                className="mt-2 text-xs text-muted underline hover:text-foreground"
              >
                Show the lifetime price anyway
              </button>
            )}
          </Field>
        )}

        <Field label="What year were you born?">
          <NumberInput
            label="Birth year"
            min={1900}
            value={input.birthYear}
            onChange={(n) => set({ birthYear: n ?? DEFAULT_LIFETIME_INPUT.birthYear })}
          />
        </Field>

        {has("internet") && (
          <Field label="Hours online a day" hint="A rough average is fine. Count time on any device.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(INTERNET_ACTIVITIES) as InternetActivity[]).map((k) => (
                <label key={k} className="block">
                  <span className="block text-sm font-medium">{INTERNET_ACTIVITIES[k].label}</span>
                  {INTERNET_ACTIVITIES[k].hint && (
                    <span className="block text-xs text-muted">{INTERNET_ACTIVITIES[k].hint}</span>
                  )}
                  <span className="mt-1 block">
                    <NumberInput
                      label={`${INTERNET_ACTIVITIES[k].label} hours a day`}
                      step={0.25}
                      suffix="hours a day"
                      value={input.internetHoursPerDay[k]}
                      onChange={(n) => set({ internetHoursPerDay: { ...input.internetHoursPerDay, [k]: n ?? 0 } })}
                    />
                  </span>
                </label>
              ))}
            </div>
          </Field>
        )}

        {has("ai") && (
          <>
            <AiExportUpload
              onResult={(s) => set(digitalFromExport(s))}
            />
            <Field label="AI chatbot prompts a day">
              <NumberInput
                label="AI prompts a day"
                suffix="prompts a day"
                value={input.aiPromptsPerDay}
                onChange={(n) => set({ aiPromptsPerDay: n ?? 0, aiFromExport: false, aiWhPerPrompt: undefined })}
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

        {has("devices") && (
          <Field label="Devices you use" hint="How many of each you have at a time. We count each one you'll go through, and the power to run it.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DEVICE_LABELS) as Device[]).map((k) => (
                <NumberInput
                  key={k}
                  label={DEVICE_LABELS[k]}
                  min={0}
                  suffix={k === "tv" ? "TVs" : DEVICE_LABELS[k].toLowerCase()}
                  value={input.devices[k]}
                  onChange={(n) => set({ devices: { ...input.devices, [k]: Math.max(0, Math.round(n ?? 0)) } })}
                />
              ))}
            </div>
          </Field>
        )}
      </div>

      <aside className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-4">
          <Badge area={badgeName(items)} detail={SPANS[span].badge} size="sm" />
          <div>
            <div className="text-sm text-muted">
              {monthly ? "Each month, cancel anytime" : span === "past" ? "One payment, everything to date" : "One payment, for life"}
            </div>
            <div className="text-3xl font-semibold">
              {usd(o.total)}
              {monthly && <span className="text-base font-normal text-muted"> a month</span>}
            </div>
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          {items.map((k) => (
            <div key={k}>
              <div className="flex justify-between">
                <dt className="text-muted">{LIFETIME_ITEMS[k].label}</dt>
                <dd>{usd(o.parts[k].cost)}</dd>
              </div>
              {k === "internet" && (
                <div className="mt-0.5 space-y-0.5 border-l-2 border-border pl-3 text-xs">
                  {(Object.keys(INTERNET_ACTIVITIES) as InternetActivity[])
                    .filter((a) => o.internetByActivity[a] > 0)
                    .map((a) => (
                      <div key={a} className="flex justify-between">
                        <dt className="text-muted">{INTERNET_ACTIVITIES[a].label}</dt>
                        <dd>{usd(o.internetByActivity[a])}</dd>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1">
            <dt className="text-muted">Donation to charities</dt>
            <dd>{usd(o.donation)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{monthly ? "Our monthly fee" : "Our one-time fee"}</dt>
            <dd>{usd(o.fee)}</dd>
          </div>
        </dl>
        <div className="border-t border-border pt-4 text-sm">
          <p className="font-medium">What it covers</p>
          <p className="mt-1 text-muted">
            {covered.join(", ")}.
            {span === "lifetime" && has("ai") && " Future AI use is counted three times over in case it grows."}
            {o.donation === minimum && ` The math comes to less than ${usd(minimum)}, so we round up to it.`}
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
          <p className="mb-3 text-sm text-muted">Payments open soon. Join the waitlist to be first in line.</p>
          <WaitlistForm />
        </div>
      </aside>
    </div>
  );
}
