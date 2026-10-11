"use client";

import { useEffect, useState } from "react";
import { AiExportUpload } from "./AiExportUpload";
import { Badge } from "./Badge";
import { NumberInput, Select } from "./fields";
import { WaitlistForm } from "./WaitlistForm";
import { STATE_OPTIONS, STATES, type StateCode } from "@/lib/data/states";
import { IMPACT_INFO } from "@/lib/impacts";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { digitalFromExport } from "@/lib/ai/exportParser";
import {
  ANNUAL_FEE_MONTHS,
  ANNUAL_MIN_DONATION_USD,
  BILLING,
  type Billing,
  DEFAULT_BILLING,
  LIFETIME_MIN_DONATION_USD,
  MIN_DONATION_USD,
  usd,
} from "@/lib/pricing";
import {
  aheadFor,
  aiBreakdown,
  type Cover,
  coverBadge,
  coverPrice,
  DEFAULT_CONTEXT,
  defaultAmount,
  effectiveCover,
  PRODUCTS,
  planTotals,
  SECTIONS,
  sourcesFor,
  type Context,
  type Product,
} from "@/lib/store";

// v2: covers replaced spans, so older saved plans are ignored.
const STORAGE_KEY = "offset:plan:v2";

interface Saved {
  ctx: Context;
  amounts: Record<string, number | string>;
  picked: Record<string, Partial<Cover>>;
  anyway: Record<string, boolean>;
  plan: string[];
  billing?: Billing | null;
  entered?: Record<string, boolean>;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const once = (n: number) => usd(Math.max(0.01, Math.ceil(n * 100) / 100));
const per = (monthly: number, billing: Billing) => `${usd(billing === "annual" ? monthly * 12 : monthly)} ${BILLING[billing].per}`;
function priceText(price: { once: number; monthly: number }, cover: Cover, billing: Billing) {
  const parts = [];
  if (price.once > 0) parts.push(`${once(price.once)} ${cover.past && cover.ahead === "lifetime" ? "for life" : "once"}`);
  if (cover.ahead === "monthly") parts.push(per(price.monthly, billing));
  return parts.join(" + ");
}
const amountText = (p: Product, amount: number | string) =>
  p.amount.kind === "number"
    ? `${p.amount.prefix ?? ""}${typeof amount === "number" ? amount.toLocaleString("en-US") : amount} ${
        amount === 1 ? p.amount.unit.replace("images or videos", "image or video").replace(/^(hour|mile|prompt)s/, "$1").replace("round trips", "round trip") : p.amount.unit
      }`
    : (p.amount.options.find((o) => o.value === amount)?.label ?? String(amount));
const providerName = (id: ProviderId) => PROVIDERS.find((x) => x.id === id)?.name ?? id;
const LIVE_LINKS = new Set<ProviderId>(["chatgpt", "claude", "openai-api", "anthropic-api"]);
const LINK_ROW: { id: ProviderId; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT or Claude" },
  { id: "utility", label: "Electric and gas utility" },
  { id: "bank", label: "Bank or card" },
  { id: "car", label: "Car" },
];

/** The storefront: link accounts to fill in your amounts, then pick the parts of your life to offset. */
export function Store() {
  const [ctx, setCtx] = useState<Context>(DEFAULT_CONTEXT);
  const [amounts, setAmounts] = useState<Record<string, number | string>>({});
  const [entered, setEntered] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, Partial<Cover>>>({});
  const [anyway, setAnyway] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<string[]>([]);
  const [billingPick, setBilling] = useState<Billing | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [asked, setAsked] = useState<ProviderId[]>([]);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    const s = load();
    if (!s) return;
    setCtx({ ...DEFAULT_CONTEXT, ...s.ctx });
    setAmounts(s.amounts ?? {});
    setEntered(s.entered ?? {});
    setPicked(s.picked ?? {});
    setAnyway(s.anyway ?? {});
    setPlan(s.plan ?? []);
    setBilling(s.billing ?? null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ctx, amounts, entered, picked, anyway, plan, billing: billingPick } satisfies Saved),
      );
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [ctx, amounts, entered, picked, anyway, plan, billingPick]);

  const amountOf = (p: Product) => amounts[p.id] ?? defaultAmount(p, ctx);
  const coverOf = (p: Product) => effectiveCover(p, amountOf(p), ctx, picked[p.id], anyway[p.id]);
  const lines = plan.map((id) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    return { productId: id, amount: amountOf(p), cover: coverOf(p) };
  });
  const billing = billingPick ?? DEFAULT_BILLING;
  const totals = planTotals(lines, ctx, billing);
  const toggle = (id: string) => setPlan((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const setAmount = (p: Product, v: number | string) => {
    setAmounts((a) => ({ ...a, [p.id]: v }));
    setEntered((e) => ({ ...e, [p.id]: true }));
  };
  const link = (id: ProviderId) => {
    if (LIVE_LINKS.has(id)) {
      setMeasuring(true);
      document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else setAsked((a) => (a.includes(id) ? a : [...a, id]));
  };

  const sourceNote = (p: Product) => {
    if (entered[p.id]) return "you entered";
    if (p.section === "ai" && ctx.aiFromExport) return "measured from your account";
    if (p.id === "electricity") return `typical for ${STATES[ctx.state].name}`;
    return "typical";
  };

  /** Amount, where it came from, and the way to replace it: link first, typing second. */
  const amountLine = (p: Product) => {
    const amount = amountOf(p);
    const sources = sourcesFor(p);
    const fromAccount = p.section === "ai" && ctx.aiFromExport && !entered[p.id];
    const waiting = sources.find((s) => asked.includes(s));
    if (editing === p.id) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {p.amount.kind === "number" ? (
            <NumberInput
              label={p.amount.label}
              step={p.amount.step}
              prefix={p.amount.prefix}
              suffix={p.amount.unit}
              value={typeof amount === "number" ? amount : undefined}
              onChange={(n) => setAmount(p, n ?? 0)}
            />
          ) : (
            <Select label={p.amount.label} value={String(amount)} onChange={(v) => setAmount(p, v)} options={p.amount.options} />
          )}
          <button type="button" onClick={() => setEditing(null)} className="min-h-10 px-2 text-sm font-medium underline">
            Done
          </button>
        </div>
      );
    }
    return (
      <div className="text-sm">
        <span className="flex flex-wrap items-center gap-x-4">
          <span>
            <span className="font-semibold tabular-nums">{amountText(p, amount)}</span>
            <span className="text-muted"> · {sourceNote(p)}</span>
          </span>
          {sources.length > 0 && !fromAccount && (
            <button
              type="button"
              onClick={() => link(sources[0])}
              className="inline-flex min-h-10 items-center font-semibold text-accent underline underline-offset-4 hover:text-accent-strong"
            >
              Link your {p.section === "ai" ? "ChatGPT or Claude" : providerName(sources[0]).toLowerCase()}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(p.id)}
            className="inline-flex min-h-10 items-center text-muted underline underline-offset-4 hover:text-foreground"
          >
            {sources.length ? "Type it in" : "Change"}
          </button>
        </span>
        {waiting && (
          <span className="block text-muted">
            Linking your {providerName(waiting).toLowerCase()} opens at launch. Until then we use the typical amount.
          </span>
        )}
      </div>
    );
  };

  /** Past use is a checkbox; going forward is ongoing or lifetime, one or the other. */
  const coverControls = (p: Product) => {
    if (!p.oneTime) return null;
    const amount = amountOf(p);
    const cover = coverOf(p);
    const options = aheadFor(p, amount, ctx, anyway[p.id]);
    const hiddenLifetime = !options.includes("lifetime") && !anyway[p.id];
    const pastPrice = p.cost(amount, "past", ctx);
    return (
      <div className="space-y-1 text-sm">
        <label className="flex min-h-9 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={cover.past}
            onChange={(e) => setPicked((x) => ({ ...x, [p.id]: { ...x[p.id], past: e.target.checked } }))}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Include past use <span className="figures text-muted">({once(pastPrice)})</span>
          </span>
        </label>
        {options.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`How to cover ${p.name} from now on`}>
            {options.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={cover.ahead === a}
                onClick={() => setPicked((x) => ({ ...x, [p.id]: { ...x[p.id], ahead: a } }))}
                className={`min-h-10 rounded-md border px-3 ${
                  cover.ahead === a ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"
                }`}
              >
                {a === "monthly" ? BILLING[billing].label : "Lifetime"}{" "}
                <span className="figures">
                  {a === "monthly"
                    ? usd((billing === "annual" ? 12 : 1) * p.cost(amount, "monthly", ctx))
                    : once(p.cost(amount, "future", ctx))}
                </span>
              </button>
            ))}
          </div>
        )}
        {hiddenLifetime && (
          <button
            type="button"
            onClick={() => setAnyway((x) => ({ ...x, [p.id]: true }))}
            className="min-h-10 text-muted underline underline-offset-4 hover:text-foreground"
          >
            Show the lifetime price anyway
          </button>
        )}
      </div>
    );
  };

  const addButton = (p: Product, wide = false) => {
    const inPlan = plan.includes(p.id);
    return (
      <button
        type="button"
        aria-pressed={inPlan}
        onClick={() => toggle(p.id)}
        className={`min-h-11 shrink-0 rounded-md px-4 font-semibold ${wide ? "w-full" : ""} ${
          inPlan ? "border-2 border-accent text-accent" : "bg-accent text-on-accent hover:bg-accent-strong"
        }`}
      >
        {inPlan ? "✓ In your plan" : "Offset this"}
      </button>
    );
  };

  const row = (p: Product) => {
    const price = coverPrice(p, amountOf(p), coverOf(p), ctx);
    return (
      <li key={p.id} className="grid gap-3 border-b border-border py-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-start">
        <div className="space-y-1">
          <div>
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-muted">{p.blurb}</p>
          </div>
          {amountLine(p)}
          {coverControls(p)}
        </div>
        <div className="figures font-medium sm:pt-0.5 sm:text-right">{priceText(price, coverOf(p), billing)}</div>
        {addButton(p)}
      </li>
    );
  };

  const ai = PRODUCTS.find((p) => p.id === "ai")!;
  const aiAmount = amountOf(ai);
  const aiCover = coverOf(ai);
  const aiPrice = coverPrice(ai, aiAmount, aiCover, ctx);
  const ab = aiBreakdown(typeof aiAmount === "number" ? aiAmount : 0, ctx);
  const linkedSomething = ctx.aiFromExport;

  return (
    <div className="pb-32">
      <section className="grid gap-10 pt-10 pb-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pt-14">
        <div>
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-6xl">
            Your AI habit, paid off for life: about {once(aiPrice.once || aiPrice.monthly)}.
          </h1>
          <p className="mt-6 max-w-xl text-lg">
            Every prompt runs on data centers that burn power, pollute the air and use water, much of it in dry places.
            Link your ChatGPT or Claude account and we measure your real use, down to how long your chats run and which
            models you pick. Then your money goes to charities that cut carbon, clean up air and save water.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => setMeasuring(true)}
              className="min-h-12 rounded-md bg-accent px-6 text-lg font-semibold text-on-accent hover:bg-accent-strong"
            >
              {ctx.aiFromExport ? "Link another account" : "Link ChatGPT or Claude"}
            </button>
            <button
              type="button"
              onClick={() => setEditing("ai")}
              className="min-h-12 text-muted underline underline-offset-4 hover:text-foreground"
            >
              Or type in how much you use it
            </button>
          </div>
          {measuring && (
            <div className="mt-6 max-w-xl">
              <AiExportUpload
                onResult={(s) => {
                  const d = digitalFromExport(s);
                  setCtx((c) => ({ ...c, aiWhPerPrompt: d.aiWhPerPrompt, aiFromExport: true }));
                  setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek }));
                  setEntered((e) => ({ ...e, ai: false, "ai-media": false }));
                }}
              />
            </div>
          )}
        </div>

        <aside id="ai-chat" aria-label="AI chat, itemized" className="self-start border-t-4 border-rule pt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold">AI chat</h2>
            <span className="text-sm text-muted">ChatGPT, Claude, Gemini and the rest</span>
          </div>
          <div className="mt-3 border-b border-border pb-3">{amountLine(ai)}</div>
          <dl className="figures divide-y divide-border text-sm">
            {[
              ["Years covered", `${ab.pastYears.toFixed(1)} so far + ${Math.round(ab.futureYears)} to come`],
              ...(["carbon", "air", "water"] as const).map((k) => [IMPACT_INFO[k].label, IMPACT_INFO[k].format(ab.impacts[k])]),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="font-sans text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-muted">
            Includes a share of training the models and building the data centers. Future use counts three times over in
            case it grows.
          </p>
          <div className="mt-4">{coverControls(ai)}</div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t-2 border-rule pt-3">
            <span className="figures text-2xl font-medium">{priceText(aiPrice, aiCover, billing)}</span>
            {addButton(ai)}
          </div>
        </aside>
      </section>

      <section aria-labelledby="link-heading" className="mb-14 bg-card px-4 py-6 sm:px-6">
        <h2 id="link-heading" className="text-2xl font-bold">
          {linkedSomething ? "Link the rest" : "Swap our typical amounts for yours"}
        </h2>
        <p className="mt-1 max-w-2xl text-muted">
          Each account you link replaces a guess with your real numbers. Everything is read-only, and you can unlink any
          time.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {LINK_ROW.map((l) => {
            const done = l.id === "chatgpt" && ctx.aiFromExport;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => link(l.id)}
                  className={`min-h-11 rounded-md border-2 px-4 font-semibold ${
                    done ? "border-accent text-accent" : "border-rule bg-background hover:bg-foreground hover:text-background"
                  }`}
                >
                  {done ? `✓ ${l.label}` : l.label}
                </button>
              </li>
            );
          })}
        </ul>
        {asked.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Linking your {asked.map((a) => providerName(a).toLowerCase()).join(" and ")} opens at launch. Until then the
            items below use typical amounts for {STATES[ctx.state].name}.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-border pt-4 text-sm">
          <label className="block">
            <span className="block font-medium">Born in</span>
            <span className="mt-1 block w-28">
              <NumberInput
                label="Birth year"
                min={1900}
                value={ctx.birthYear}
                onChange={(n) => setCtx((c) => ({ ...c, birthYear: n ?? DEFAULT_CONTEXT.birthYear }))}
              />
            </span>
          </label>
          <label className="block w-52">
            <span className="block font-medium">State</span>
            <span className="mt-1 block">
              <Select
                label="State"
                value={ctx.state}
                onChange={(v) => setCtx((c) => ({ ...c, state: v as StateCode }))}
                options={STATE_OPTIONS.map((s) => ({ value: s.code, label: s.name }))}
              />
            </span>
          </label>
          <p className="max-w-xs text-muted">Your age sets how many years a lifetime offset covers. Your state sets how clean your power is.</p>
        </div>
      </section>

      {SECTIONS.map((s) => {
        const items = PRODUCTS.filter((p) => p.section === s.key && p.id !== "ai");
        if (!items.length) return null;
        return (
          <section key={s.key} className="mb-12" aria-labelledby={`section-${s.key}`}>
            <div className="flex flex-col gap-1 border-b-2 border-rule pb-2 sm:flex-row sm:items-baseline sm:gap-4">
              <h2 id={`section-${s.key}`} className="text-2xl font-bold">
                {s.title}
              </h2>
              <p className="text-muted">{s.blurb}</p>
            </div>
            <ul>{items.map(row)}</ul>
            {(s.key === "online" || s.key === "devices") && (
              <p className="mt-3 text-sm text-muted">
                No account can measure this yet, so it starts from typical use.
                {s.key === "devices" && " Not counted: water and land used to mine and make devices, and e-waste."}
              </p>
            )}
          </section>
        );
      })}

      {plan.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-rule bg-background">
          <div className="mx-auto max-w-5xl px-4">
            {open && (
              <div className="max-h-[60vh] overflow-y-auto border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Your plan</h2>
                  <button type="button" onClick={() => setOpen(false)} className="min-h-10 text-sm underline">
                    Close
                  </button>
                </div>
                <ul className="mt-2 divide-y divide-border">
                  {totals.lines.map((l) => (
                    <li key={l.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{l.product.name}</span>{" "}
                        <span className="text-muted">· {coverBadge(l.cover, billing)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="figures">
                          {priceText({ once: l.pastCost + (l.cover.ahead === "lifetime" ? l.aheadCost : 0), monthly: l.aheadCost }, l.cover, billing)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggle(l.productId)}
                          aria-label={`Remove ${l.product.name}`}
                          className="min-h-10 min-w-10 text-muted hover:text-foreground"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="figures mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {totals.oneTime && (
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">
                        One payment: {usd(totals.oneTime.donation)} to charities + {usd(totals.oneTime.fee)} fee
                      </dt>
                      <dd className="font-medium">{usd(totals.oneTime.total)}</dd>
                    </div>
                  )}
                  {totals.recurring && (
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">
                        {billing === "annual" ? "Each year" : "Each month"}: {usd(totals.recurring.donation)} to charities +{" "}
                        {usd(totals.recurring.fee)} fee
                      </dt>
                      <dd className="font-medium">{usd(totals.recurring.total)}</dd>
                    </div>
                  )}
                </dl>
                {totals.recurring && (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="How often to pay">
                    {(["monthly", "annual"] as Billing[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        role="radio"
                        aria-checked={billing === b}
                        onClick={() => setBilling(b)}
                        className={`min-h-10 rounded-md border px-3 ${
                          billing === b ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"
                        }`}
                      >
                        Pay {BILLING[b].label.toLowerCase()}
                        {b === "annual" && ` (${12 - ANNUAL_FEE_MONTHS} months of fees free)`}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  Donations have a minimum of {usd(LIFETIME_MIN_DONATION_USD)} for one-time payments,{" "}
                  {usd(ANNUAL_MIN_DONATION_USD)} a year or {usd(MIN_DONATION_USD)} a month. You approve every payment
                  yourself; nothing is charged automatically.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {totals.lines.map((l) => (
                    <Badge key={l.productId} area={l.product.name} detail={coverBadge(l.cover, billing)} size="sm" />
                  ))}
                </div>
                {checkout && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-muted">Payments open at launch. Leave your email and we&apos;ll save your plan.</p>
                    <WaitlistForm />
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <button type="button" onClick={() => setOpen((o) => !o)} className="text-left text-sm">
                <span className="font-semibold">
                  Your plan · {plan.length} {plan.length === 1 ? "item" : "items"}
                </span>
                <span className="figures block text-muted">
                  {[totals.oneTime && `${usd(totals.oneTime.total)} once`, totals.recurring && `${usd(totals.recurring.total)} ${BILLING[billing].per}`]
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
                className="min-h-11 shrink-0 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
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
