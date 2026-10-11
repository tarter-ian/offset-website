"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Badge } from "./Badge";
import { NumberInput, Select } from "./fields";
import { WaitlistForm } from "./WaitlistForm";
import { STATE_OPTIONS, type StateCode } from "@/lib/data/states";
import { digitalFromExport } from "@/lib/ai/exportParser";
import { SPANS, type Span } from "@/lib/lifetime";
import { LIFETIME_MIN_DONATION_USD, MIN_DONATION_USD, usd } from "@/lib/pricing";
import {
  DEFAULT_CONTEXT,
  defaultAmount,
  effectiveSpan,
  PRODUCTS,
  planTotals,
  SECTIONS,
  spansFor,
  type Context,
  type Product,
} from "@/lib/store";

const STORAGE_KEY = "offset:plan";

interface Saved {
  ctx: Context;
  amounts: Record<string, number | string>;
  picked: Record<string, Span>;
  anyway: Record<string, boolean>;
  plan: string[];
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const priceText = (cost: number, span: Span) =>
  span === "monthly" ? `${usd(cost)} a month` : `${usd(Math.max(0.01, Math.ceil(cost * 100) / 100))} ${span === "past" ? "to date" : "for life"}`;

/** The storefront: browse parts of your life, set your amount, and add the ones you want to offset to your plan. */
export function Store() {
  const [ctx, setCtx] = useState<Context>(DEFAULT_CONTEXT);
  const [amounts, setAmounts] = useState<Record<string, number | string>>({});
  const [picked, setPicked] = useState<Record<string, Span>>({});
  const [anyway, setAnyway] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    const s = load();
    if (!s) return;
    setCtx({ ...DEFAULT_CONTEXT, ...s.ctx });
    setAmounts(s.amounts ?? {});
    setPicked(s.picked ?? {});
    setAnyway(s.anyway ?? {});
    setPlan(s.plan ?? []);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ctx, amounts, picked, anyway, plan } satisfies Saved));
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [ctx, amounts, picked, anyway, plan]);

  const amountOf = (p: Product) => amounts[p.id] ?? defaultAmount(p, ctx);
  const spanOf = (p: Product) => effectiveSpan(p, amountOf(p), ctx, picked[p.id], anyway[p.id]);
  const totals = planTotals(
    plan.map((id) => {
      const p = PRODUCTS.find((x) => x.id === id)!;
      return { productId: id, amount: amountOf(p), span: spanOf(p) };
    }),
    ctx,
  );
  const toggle = (id: string) => setPlan((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const card = (p: Product, featured = false) => {
    const amount = amountOf(p);
    const span = spanOf(p);
    const spans = spansFor(p, amount, ctx, anyway[p.id]);
    const hiddenLifetime = p.oneTime && !spans.includes("lifetime") && !anyway[p.id];
    const inPlan = plan.includes(p.id);
    return (
      <div
        key={p.id}
        className={`flex flex-col gap-3 rounded-2xl border bg-card p-5 ${featured ? "border-2 border-accent" : "border-border"}`}
      >
        <div>
          <h3 className={featured ? "text-2xl font-semibold" : "font-semibold"}>{p.name}</h3>
          <p className="mt-1 text-sm text-muted">{p.blurb}</p>
        </div>
        {p.amount.kind === "number" ? (
          <NumberInput
            label={p.amount.label}
            step={p.amount.step}
            prefix={p.amount.prefix}
            suffix={p.amount.unit}
            value={typeof amount === "number" ? amount : undefined}
            onChange={(n) => setAmounts((a) => ({ ...a, [p.id]: n ?? 0 }))}
          />
        ) : (
          <Select
            label={p.amount.label}
            value={String(amount)}
            onChange={(v) => setAmounts((a) => ({ ...a, [p.id]: v }))}
            options={p.amount.options}
          />
        )}
        {featured && (
          <div className="text-sm">
            <button type="button" onClick={() => setMeasuring((m) => !m)} className="font-medium text-accent hover:underline">
              {ctx.aiFromExport ? "✓ Measured from your account" : "Measure mine from my ChatGPT, Claude or API account"}
            </button>
            {measuring && (
              <div className="mt-3">
                <AiExportUpload
                  onResult={(s) => {
                    const d = digitalFromExport(s);
                    setCtx((c) => ({ ...c, aiWhPerPrompt: d.aiWhPerPrompt, aiFromExport: true }));
                    setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek }));
                  }}
                />
              </div>
            )}
          </div>
        )}
        {spans.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`How to cover ${p.name}`}>
            {spans.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={span === s}
                onClick={() => setPicked((x) => ({ ...x, [p.id]: s }))}
                className={`rounded-md border px-2.5 py-1 text-sm ${
                  span === s ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:border-accent"
                }`}
              >
                {SPANS[s].label}
              </button>
            ))}
          </div>
        )}
        {hiddenLifetime && (
          <button
            type="button"
            onClick={() => setAnyway((x) => ({ ...x, [p.id]: true }))}
            className="self-start text-xs text-muted underline hover:text-foreground"
          >
            Show the lifetime price anyway
          </button>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className={featured ? "text-xl font-semibold" : "font-semibold"}>{priceText(p.cost(amount, span, ctx), span)}</span>
          <button
            type="button"
            aria-pressed={inPlan}
            onClick={() => toggle(p.id)}
            className={`shrink-0 rounded-lg px-4 py-2 font-medium ${
              inPlan ? "border border-accent text-accent" : "bg-accent text-white hover:bg-accent-strong"
            }`}
          >
            {inPlan ? "✓ In your plan" : "Offset this"}
          </button>
        </div>
      </div>
    );
  };

  const ai = PRODUCTS.find((p) => p.id === "ai")!;

  return (
    <div className="pb-32">
      <section className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-accent">Offset your AI</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Use AI guilt-free. Offset it for life.</h1>
          <p className="mt-5 text-lg text-muted">
            Every prompt runs on data centers that burn power and drink water. One payment covers the carbon, air
            pollution and water behind all your AI use, past and future. Then browse the rest of your life and offset
            whatever you care about.
          </p>
        </div>
        {card(ai, true)}
      </section>

      <div className="mb-10 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
        <label className="block">
          <span className="block text-sm font-medium">Born in</span>
          <span className="mt-1 block">
            <NumberInput
              label="Birth year"
              min={1900}
              value={ctx.birthYear}
              onChange={(n) => setCtx((c) => ({ ...c, birthYear: n ?? DEFAULT_CONTEXT.birthYear }))}
            />
          </span>
        </label>
        <label className="block sm:w-56">
          <span className="block text-sm font-medium">State</span>
          <span className="mt-1 block">
            <Select
              label="State"
              value={ctx.state}
              onChange={(v) => setCtx((c) => ({ ...c, state: v as StateCode }))}
              options={STATE_OPTIONS.map((s) => ({ value: s.code, label: s.name }))}
            />
          </span>
        </label>
        <p className="text-sm text-muted sm:ml-auto sm:max-w-64">
          Prices use typical amounts.{" "}
          <Link href="/start" className="text-accent hover:underline">
            Link your accounts
          </Link>{" "}
          for your exact numbers.
        </p>
      </div>

      {SECTIONS.map((s) => {
        const items = PRODUCTS.filter((p) => p.section === s.key && p.id !== "ai");
        if (!items.length) return null;
        return (
          <section key={s.key} className="mb-12" aria-labelledby={`section-${s.key}`}>
            <h2 id={`section-${s.key}`} className="text-2xl font-semibold tracking-tight">
              {s.title}
            </h2>
            <p className="mt-1 text-muted">{s.blurb}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => card(p))}</div>
          </section>
        );
      })}

      {plan.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card shadow-lg">
          <div className="mx-auto max-w-5xl px-4">
            {open && (
              <div className="max-h-[60vh] overflow-y-auto border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your plan</h2>
                  <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
                    Close
                  </button>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {totals.lines.map((l) => (
                    <li key={l.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{l.product.name}</span>{" "}
                        <span className="text-muted">· {SPANS[l.span].label.toLowerCase()}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span>{priceText(l.cost, l.span)}</span>
                        <button
                          type="button"
                          onClick={() => toggle(l.productId)}
                          aria-label={`Remove ${l.product.name}`}
                          className="text-muted hover:text-foreground"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {totals.oneTime && (
                    <div className="flex justify-between">
                      <dt className="text-muted">
                        One payment: {usd(totals.oneTime.donation)} to charities + {usd(totals.oneTime.fee)} fee
                      </dt>
                      <dd className="font-medium">{usd(totals.oneTime.total)}</dd>
                    </div>
                  )}
                  {totals.monthly && (
                    <div className="flex justify-between">
                      <dt className="text-muted">
                        Each month: {usd(totals.monthly.donation)} to charities + {usd(totals.monthly.fee)} fee
                      </dt>
                      <dd className="font-medium">{usd(totals.monthly.total)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2 text-xs text-muted">
                  One-time donations have a {usd(LIFETIME_MIN_DONATION_USD)} minimum and monthly ones {usd(MIN_DONATION_USD)}. You approve every monthly payment;
                  nothing is charged automatically.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {totals.lines.map((l) => (
                    <Badge key={l.productId} area={l.product.name} detail={SPANS[l.span].badge} size="sm" />
                  ))}
                </div>
                {checkout && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-muted">Payments open soon. Join the waitlist and we&apos;ll save your plan.</p>
                    <WaitlistForm />
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <button type="button" onClick={() => setOpen((o) => !o)} className="text-left text-sm">
                <span className="font-medium">
                  Your plan · {plan.length} {plan.length === 1 ? "item" : "items"}
                </span>
                <span className="block text-muted">
                  {[totals.oneTime && `${usd(totals.oneTime.total)} once`, totals.monthly && `${usd(totals.monthly.total)} a month`]
                    .filter(Boolean)
                    .join(" + ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setCheckout(true);
                }}
                className="shrink-0 rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:bg-accent-strong"
              >
                Offset these
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
