"use client";

import { useEffect, useState } from "react";
import { ActivityUpload } from "./ActivityUpload";
import { AiExportUpload } from "./AiExportUpload";
import { AiQuickPick } from "./AiQuickPick";
import { AI_LEVELS } from "@/lib/ai/levels";
import { NumberInput, Select } from "./fields";
import { STATE_OPTIONS, STATES, type StateCode } from "@/lib/data/states";
import { IMPACT_INFO } from "@/lib/impacts";
import { IMPACT_KEYS, sumImpacts, type Impacts } from "@/lib/footprint";
import { howEstimated, whereItGoes } from "@/lib/methods";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { digitalFromExport } from "@/lib/ai/exportParser";
import { SOURCE_NAMES, type ActivitySource } from "@/lib/activity";
import * as F from "@/lib/factors";
import { ONLINE_FROM_AGE } from "@/lib/factors";
import {
  LIFETIME_GROWTH_BUFFER,
  BILLING,
  type Billing,
  DEFAULT_BILLING,
  MIN_DONATION_USD,
  usd,
} from "@/lib/pricing";
import {
  aheadFor,
  aiLeadsLifetime,
  SMALL_MONTHLY_USD,
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
  coverImpacts,
  sourcesFor,
  yearlyLine,
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
  pastAll?: boolean;
  linkedFrom?: Record<string, ActivitySource[]>;
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
/** Fits a store tile: a big figure with a small note, e.g. "$4.75" / "for life" or "$80.74" / "+ $0.34 a month". */
/** A tile's price: the monthly price first, unless the item is set to be paid once for life. */
function tilePrice(price: { once: number; monthly: number }, cover: Cover, billing: Billing) {
  const ongoing = usd(billing === "annual" ? price.monthly * 12 : price.monthly);
  const per = BILLING[billing].per;
  if (cover.ahead === "monthly") return { big: ongoing, note: price.once > 0 ? `${per} + ${once(price.once)} once for past use` : per };
  return { big: once(price.once), note: cover.past ? "once, for life" : "once, for all future use" };
}
/** Every kind of harm covered, skipping ones too small to show, e.g. "181 kg CO₂e · 7.7 min of life · 947 L water". */
const MIN_SHOWN: Impacts = { carbon: 0.005, air: 0.0005, water: 0.05, land: 0.001, ewaste: 0.01 };
const coversText = (i: Impacts) =>
  IMPACT_KEYS.filter((k) => i[k] >= MIN_SHOWN[k])
    .map((k) => IMPACT_INFO[k].format(i[k]))
    .join(" · ");

const amountText = (p: Product, amount: number | string) =>
  p.amount.kind === "number"
    ? `${p.amount.prefix ?? ""}${typeof amount === "number" ? amount.toLocaleString("en-US") : amount} ${
        amount === 1 ? p.amount.unit.replace(/^(image|video)s/, "$1").replace(/^(hour|mile|prompt)s/, "$1").replace("round trips", "round trip") : p.amount.unit
      }`
    : (p.amount.options.find((o) => o.value === amount)?.label ?? String(amount));
const providerName = (id: ProviderId) => PROVIDERS.find((x) => x.id === id)?.name ?? id;
const SHELF_SIZE = 3;
const LIVE_LINKS = new Set<ProviderId>(["chatgpt", "claude", "gemini", "openai-api", "anthropic-api", "activity"]);
const LINK_ROW: { id: ProviderId; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT, Claude or Gemini" },
  { id: "activity", label: "Spotify, YouTube, Netflix or Google Maps" },
  { id: "utility", label: "Electric and gas utility" },
  { id: "car", label: "Car" },
];

// Optional tips toward hosting and upkeep; the default is none.
const TIPS = [0, 1, 3, 5];

// When someone started using AI, for past use when no history is linked. ChatGPT launched in late 2022.
const AI_START_OPTIONS = Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => {
  const y = 2022 + i;
  return { value: String(y), label: y === 2022 ? "Late 2022" : String(y) };
});

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
  // An optional tip toward running the site, added once to the next payment. Off unless chosen.
  const [tip, setTip] = useState(0);
  const [adjusting, setAdjusting] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Which downloaded histories filled in each tile's amount.
  const [linkedFrom, setLinkedFrom] = useState<Record<string, ActivitySource[]>>({});
  // Past use is one switch for the whole plan; an item can still be changed on its own.
  const [pastAll, setPastAllState] = useState(true);
  const [details, setDetails] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = load();
    // Until someone picks a state, start from the one their connection is in.
    if (!s?.ctx?.statePicked) {
      fetch("/api/region")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { state?: StateCode | null } | null) => {
          const state = d?.state;
          if (state && state in STATES) setCtx((c) => (c.statePicked ? c : { ...c, state }));
        })
        .catch(() => {});
    }
    if (!s) return;
    setCtx({ ...DEFAULT_CONTEXT, ...s.ctx });
    setAmounts(s.amounts ?? {});
    setEntered(s.entered ?? {});
    setPicked(s.picked ?? {});
    setAnyway(s.anyway ?? {});
    setPlan(s.plan ?? []);
    setBilling(s.billing ?? null);
    setPastAllState(s.pastAll ?? true);
    setLinkedFrom(s.linkedFrom ?? {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ctx, amounts, entered, picked, anyway, plan, billing: billingPick, pastAll, linkedFrom } satisfies Saved),
      );
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [ctx, amounts, entered, picked, anyway, plan, billingPick, pastAll, linkedFrom]);

  const amountOf = (p: Product) => amounts[p.id] ?? defaultAmount(p, ctx);
  const coverOf = (p: Product) => effectiveCover(p, amountOf(p), ctx, { past: pastAll, ...picked[p.id] }, anyway[p.id]);
  const setPastAll = (v: boolean) => {
    setPastAllState(v);
    setPicked((x) => Object.fromEntries(Object.entries(x).map(([id, c]) => [id, { ...c, past: undefined }])));
  };
  const setPast = (id: string, v: boolean) => setPicked((x) => ({ ...x, [id]: { ...x[id], past: v } }));
  const lines = plan.map((id) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    return { productId: id, amount: amountOf(p), cover: coverOf(p) };
  });
  const billing = billingPick ?? DEFAULT_BILLING;
  const totals = planTotals(lines, ctx, billing);
  // Everything charged today: the one-time payment, the first ongoing payment and any tip.
  const dueToday = (totals.oneTime?.total ?? 0) + (totals.recurring?.total ?? 0) + tip;
  // Room below the footer for the plan bar, so it never covers the last lines of the page.
  useEffect(() => {
    document.body.style.paddingBottom = plan.length ? "5rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [plan.length]);

  const toggle = (id: string) => setPlan((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  // Meat, dairy and plant foods are three parts of one diet, so they share one answer.
  const FOOD_IDS = PRODUCTS.filter((x) => x.section === "food").map((x) => x.id);
  // A new AI amount goes back to AI's default cover: lifetime up to $100, monthly above (Ian, 2026-10-11).
  const resetAiCover = () => setPicked((x) => (x.ai?.ahead ? { ...x, ai: { ...x.ai, ahead: undefined } } : x));
  const setAmount = (p: Product, v: number | string) => {
    const ids = p.section === "food" ? FOOD_IDS : [p.id];
    if (p.id === "ai") resetAiCover();
    setAmounts((a) => ({ ...a, ...Object.fromEntries(ids.map((id) => [id, v])) }));
    setEntered((e) => ({ ...e, ...Object.fromEntries(ids.map((id) => [id, true])) }));
  };
  const link = (id: ProviderId) => {
    if (id === "activity") {
      setActivityOpen(true);
      requestAnimationFrame(() => document.getElementById("link-activity")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } else if (LIVE_LINKS.has(id)) {
      setMeasuring(true);
      document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else setAsked((a) => (a.includes(id) ? a : [...a, id]));
  };

  const linkLabel = (p: Product, src: ProviderId) => {
    if (p.section === "ai") return "Link your AI account";
    if (src !== "activity") return `Link your ${providerName(src).toLowerCase()}`;
    if (p.id === "music") return "Add your Spotify or YouTube history";
    if (p.id === "video") return "Add your YouTube or Netflix history";
    return "Add your Google Maps Timeline";
  };

  const sourceNote = (p: Product) => {
    if (entered[p.id]) return "you entered";
    if (p.id === "ai" && ctx.aiFromExport && ctx.aiCode)
      return `measured from your account, plus Claude Code, estimated from ${Math.round(ctx.aiCode.limitPercent)}% of your ${ctx.aiCode.plan} weekly limit`;
    if (p.section === "ai" && ctx.aiFromExport) return "measured from your account";
    if (p.id === "ai" && ctx.aiEstimate) return ctx.aiEstimate.from;
    if ((p.id === "ai-media" || p.id === "ai-video") && ctx.aiEstimate?.level) return ctx.aiEstimate.from;
    if (linkedFrom[p.id]) return `from your ${linkedFrom[p.id].map((s) => SOURCE_NAMES[s]).join(" and ")} history`;
    if (p.id === "electricity") return `typical for ${STATES[ctx.state].name}`;
    return "typical";
  };

  /** Amount, where it came from, and the way to replace it: link first, typing second. */
  const amountLine = (p: Product) => {
    const amount = amountOf(p);
    const sources = sourcesFor(p);
    const fromAccount = ((p.section === "ai" && ctx.aiFromExport) || !!linkedFrom[p.id]) && !entered[p.id];
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
              {linkLabel(p, sources[0])}
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

  /** Where the past-use figure comes from. */
  const pastNote = (p: Product) => {
    if (p.id === "ai" && ctx.aiPastWh !== undefined) return "your real history";
    if (p.section === "ai")
      return ctx.aiStartYear && ctx.aiStartYear > 2022
        ? `growing steadily to today's rate since you started in ${ctx.aiStartYear}`
        : "growing steadily to today's rate since ChatGPT launched in late 2022";
    return `today's rate since you were ${ONLINE_FROM_AGE}, or 1995`;
  };

  /** Past use is a checkbox; going forward is ongoing or lifetime, one or the other. */
  const coverControls = (p: Product, withPast = false) => {
    if (!p.oneTime) return null;
    const amount = amountOf(p);
    const cover = coverOf(p);
    const options = aheadFor(p, amount, ctx, anyway[p.id]);
    const hiddenLifetime = !options.includes("lifetime") && !anyway[p.id];
    const pastPrice = p.cost(amount, "past", ctx);
    return (
      <div className="space-y-1 text-sm">
        {withPast && (
        <label className="flex min-h-9 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={cover.past}
            onChange={(e) => setPast(p.id, e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            Include past use <span className="figures text-muted">({once(pastPrice)})</span>
            <span className="text-muted"> · {pastNote(p)}</span>
          </span>
        </label>
        )}
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

  const addButton = (p: Product, small = false) => {
    const inPlan = plan.includes(p.id);
    return (
      <button
        type="button"
        aria-pressed={inPlan}
        aria-label={small ? `${inPlan ? "Remove" : "Add"} ${p.name}${inPlan ? " from" : " to"} your plan` : undefined}
        onClick={() => toggle(p.id)}
        className={`min-h-11 shrink-0 rounded-md px-4 font-semibold ${
          inPlan
            ? small
              ? "border-2 border-foreground bg-foreground text-background"
              : "border-2 border-rule"
            : small
              ? "border-2 border-rule hover:bg-foreground hover:text-background"
              : "bg-foreground text-background hover:opacity-85"
        }`}
      >
        {inPlan ? (small ? "✓ Added" : "✓ In your plan") : small ? "Add" : "Add to plan"}
      </button>
    );
  };

  /** What an item's price pays to cover, in every kind of harm. */
  const coversLines = (p: Product): [string, string][] => {
    const cover = coverOf(p);
    const c = coverImpacts(p, amountOf(p), cover, ctx);
    const lines: [string, string][] = [];
    if (cover.ahead === "lifetime") lines.push([cover.past ? "Covers for life" : "Covers all future use", coversText(c.once)]);
    else {
      if (cover.past) lines.push(["Covers past use", coversText(c.once)]);
      const k = billing === "annual" ? 12 : 1;
      lines.push([
        billing === "annual" ? "Covers each year" : "Covers each month",
        coversText({
          carbon: c.monthly.carbon * k,
          air: c.monthly.air * k,
          water: c.monthly.water * k,
          land: c.monthly.land * k,
          ewaste: c.monthly.ewaste * k,
        }),
      ]);
    }
    return lines;
  };

  /** The (i) panel over a tile: how the item is estimated and who gets the money. */
  const infoPanel = (p: Product) => {
    const c = coverImpacts(p, amountOf(p), coverOf(p), ctx);
    const goes = whereItGoes(sumImpacts([c.once, c.monthly]));
    return (
      <div
        id={`info-${p.id}`}
        role="region"
        aria-label={`About ${p.name}`}
        className="mt-3 border-t-2 border-rule pt-3 text-sm"
      >
        <p className="mb-2">{p.blurb}</p>
        <h4 className="font-bold">How we estimate it</h4>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
          {howEstimated(p).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h4 className="mt-3 font-bold">Where the money goes</h4>
        <ul className="mt-1 space-y-1">
          {goes.map((g) => (
            <li key={g.key} className="flex justify-between gap-3">
              <span>
                <a href={g.charity.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {g.charity.name}
                </a>
                <span className="block text-xs text-muted">{g.charity.focus}</span>
              </span>
              <span className="figures shrink-0">{Math.round(g.share * 100)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Example charities until our donation partner is set. <a href="/method" className="underline">Full method and sources</a>
        </p>
      </div>
    );
  };

  /** A store tile: what it is, why it matters, your amount, the price and a one-tap add. Details open below the shelf. */
  const tile = (p: Product, index: number, collapsed: boolean) => {
    const amount = amountOf(p);
    const cover = coverOf(p);
    const price = coverPrice(p, amount, cover, ctx);
    const tp = tilePrice(price, cover, billing);
    // Nothing to offset, like meat on a vegan diet: say so instead of a $0 price.
    const nothing = price.once + price.monthly < 0.005;
    // The other way to pay, one tap away: once for life, or back to monthly.
    const options = aheadFor(p, amount, ctx, anyway[p.id]);
    const other: Cover["ahead"] = cover.ahead === "monthly" ? "lifetime" : "monthly";
    const otherPrice = coverPrice(p, amount, { ...cover, ahead: other }, ctx);
    const alt = options.includes(other)
      ? {
          ahead: other,
          text:
            other === "lifetime"
              ? `or ${once(otherPrice.once)} once, ${cover.past ? "for life" : "for all future use"}`
              : otherPrice.monthly < SMALL_MONTHLY_USD
                ? `or under $1 ${BILLING.monthly.per}`
                : `or ${usd((billing === "annual" ? 12 : 1) * otherPrice.monthly)} ${BILLING[billing].per}`,
        }
      : null;
    const isOpen = details === p.id;
    return (
      <li
        key={p.id}
        className={`flex w-[78%] shrink-0 snap-start flex-col rounded-md bg-card p-4 md:w-auto ${
          collapsed && index >= SHELF_SIZE ? "md:hidden" : ""
        } ${isOpen ? "outline-2 outline-rule" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold leading-snug">{p.name}</h3>
          <button
            type="button"
            onClick={() => setInfo(info === p.id ? null : p.id)}
            aria-expanded={info === p.id}
            aria-controls={`info-${p.id}`}
            aria-label={`How ${p.name} is estimated and where the money goes`}
            className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center"
          >
            <span
              aria-hidden
              className={`grid size-6 place-items-center rounded-full border-[1.5px] border-foreground text-sm font-bold leading-none ${
                info === p.id ? "bg-foreground text-background" : ""
              }`}
            >
              {info === p.id ? "×" : "i"}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDetails(isOpen ? null : p.id)}
          aria-expanded={isOpen}
          className="inline-flex min-h-9 items-center self-start text-left text-sm"
        >
          <span>
            <span className="font-medium">{amountText(p, amount)}</span>
            {(linkedFrom[p.id] || (p.section === "ai" && ctx.aiFromExport)) && !entered[p.id] && <span className="text-muted"> · measured</span>}
            <span className="text-muted"> · </span>
            <span className="underline underline-offset-4">{isOpen ? "Close" : "Change"}</span>
          </span>
        </button>
        {/* One line: what the big price covers. Past use is in the price note and the details. */}
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {nothing
            ? p.section === "food"
              ? `Nothing to offset on a ${amountText(p, amount).toLowerCase()} diet.`
              : "Nothing to offset at this amount."
            : `Covers ${coversLines(p).at(-1)![1]}`}
        </p>
        {info === p.id && infoPanel(p)}
        {!nothing && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="leading-tight">
            <span className="figures block text-lg font-medium">{tp.big}</span>
            <span className="block text-xs text-muted">{tp.note}</span>
          </span>
          {addButton(p, true)}
        </div>
        )}
        {alt && !nothing && (
          <button
            type="button"
            onClick={() => setPicked((x) => ({ ...x, [p.id]: { ...x[p.id], ahead: alt.ahead } }))}
            className="mt-1 inline-flex min-h-9 items-center self-start text-left text-xs underline underline-offset-4"
          >
            {alt.text}
          </button>
        )}
      </li>
    );
  };

  const detailPanel = (p: Product) => (
    <div className="mt-3 border-y-2 border-rule py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">{p.name}</h3>
          <p className="text-sm text-muted">{p.blurb}</p>
        </div>
        <button type="button" onClick={() => setDetails(null)} className="min-h-10 text-sm underline">
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <p className="text-sm">{yearlyLine(p, amountOf(p), ctx)}</p>
          {amountLine(p)}
          {coverControls(p, true)}
        </div>
        <div className="flex items-center gap-4">
          <span className="figures font-medium">{priceText(coverPrice(p, amountOf(p), coverOf(p), ctx), coverOf(p), billing)}</span>
          {addButton(p)}
        </div>
      </div>
    </div>
  );

  const ai = PRODUCTS.find((p) => p.id === "ai")!;
  const aiAmount = amountOf(ai);
  const aiCover = coverOf(ai);
  const aiPrice = coverPrice(ai, aiAmount, aiCover, ctx);
  const ab = aiBreakdown(typeof aiAmount === "number" ? aiAmount : 0, ctx, aiCover);
  const covers =
    aiCover.ahead === "lifetime"
      ? aiCover.past
        ? "Lifetime"
        : "All future use"
      : `${aiCover.past ? "Past use + " : ""}${billing === "annual" ? "each year" : "each month"}`;
  const linkedSomething = ctx.aiFromExport || Object.keys(linkedFrom).length > 0;

  return (
    <div className="pb-20">
      <section className="grid gap-10 pt-10 pb-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:pt-14">
        <div>
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-6xl">
            {aiLeadsLifetime(aiAmount, ctx)
              ? `Your AI habit, paid off for life: about ${once(coverPrice(ai, aiAmount, { past: true, ahead: "lifetime" }, ctx).once)}.`
              : `Your AI habit, offset: about ${once(coverPrice(ai, aiAmount, { past: false, ahead: "monthly" }, ctx).monthly)} a month.`}
          </h1>
          <p className="mt-6 max-w-xl text-lg">
            Every prompt runs on data centers that burn power, pollute the air and use water, much of it in dry places.
            Your money goes to charities that cut carbon, clean up air and save water.
          </p>
          <div className="mt-8 max-w-xl">
            <AiQuickPick
              level={ctx.aiFromExport || entered.ai ? null : (ctx.aiEstimate?.level ?? null)}
              onPick={(level, from) => {
                setCtx((c) => ({ ...c, aiEstimate: { level, from }, aiFromExport: false, aiWhPerPrompt: undefined, aiPastWh: undefined, aiCode: undefined }));
                // Images and video follow the pick too, unless the person typed their own.
                setAmounts((a) => ({
                  ...a,
                  ai: AI_LEVELS[level].promptsPerDay,
                  ...(entered["ai-media"] ? {} : { "ai-media": AI_LEVELS[level].imagesPerWeek }),
                  ...(entered["ai-video"] ? {} : { "ai-video": AI_LEVELS[level].videosPerWeek }),
                }));
                resetAiCover();
                setEntered((e) => ({ ...e, ai: false }));
              }}
              onExact={() => setMeasuring(true)}
              onMeasured={(s, note) => {
                const d = digitalFromExport(s);
                setCtx((c) => ({
                  ...c,
                  aiWhPerPrompt: d.aiWhPerPrompt,
                  aiCode: d.aiCode,
                  aiFromExport: !note,
                  aiPastWh: note ? undefined : d.aiPastWh,
                  aiEstimate: note ? { from: note } : undefined,
                }));
                setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek }));
                resetAiCover();
                setEntered((e) => ({ ...e, ai: false, "ai-media": false }));
              }}
            />
          </div>
          {measuring && (
            <div className="mt-6 max-w-xl">
              <AiExportUpload
                onResult={(s) => {
                  const d = digitalFromExport(s);
                  setCtx((c) => ({ ...c, aiWhPerPrompt: d.aiWhPerPrompt, aiCode: d.aiCode, aiFromExport: true, aiPastWh: d.aiPastWh, aiEstimate: undefined }));
                  setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek }));
                  resetAiCover();
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
          <div className="mt-3 border-b border-border pb-3">
            {amountLine(ai)}
            {ctx.aiFromExport && ctx.aiCode && (
              <p className="mt-1 text-sm text-muted">
                Claude Code is about{" "}
                {Math.round((ctx.aiCode.whPerDay / ((ctx.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) * Number(amountOf(ai)) || 1)) * 100)}% of the energy, or{" "}
                {Math.round(ctx.aiCode.whPerDay / F.WH_PER_AI_PROMPT).toLocaleString("en-US")} typical prompts a day. Chat apps don&apos;t count it, so
                we estimate it from your weekly limit at {F.WH_PER_CLAUDE_CODE_HOUR} Wh an hour, {F.CLAUDE_WEEKLY_HOURS[ctx.aiCode.plan === "Max 20x" ? "max_20x" : ctx.aiCode.plan === "Max 5x" ? "max_5x" : "pro"]} hours in a full {ctx.aiCode.plan} week.
              </p>
            )}
          </div>
          <dl className="figures divide-y divide-border text-sm">
            {[
              ["Covers", covers],
              ...(["carbon", "air", "water", "land"] as const).map((k) => [IMPACT_INFO[k].label, IMPACT_INFO[k].format(ab.impacts[k])]),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="font-sans text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-muted">
            Includes a share of training the models and building the data centers. Future use counts {LIFETIME_GROWTH_BUFFER} times over in
            case it grows, on a grid that gets cleaner each year.
          </p>
          <div className="mt-4">{coverControls(ai, true)}</div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t-2 border-rule pt-3">
            <span className="figures text-2xl font-medium">{priceText(aiPrice, aiCover, billing)}</span>
            {addButton(ai)}
          </div>
        </aside>
      </section>

      <section aria-label="Link accounts" className="mb-6 border-y border-border py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="font-semibold">{linkedSomething ? "Link the rest:" : "Fill in your real numbers:"}</span>
          {LINK_ROW.map((l) => {
            const done = (l.id === "chatgpt" && ctx.aiFromExport) || (l.id === "activity" && Object.keys(linkedFrom).length > 0);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => link(l.id)}
                className={`inline-flex min-h-10 items-center underline underline-offset-4 ${done ? "text-accent" : "hover:text-accent"}`}
              >
                {done ? `✓ ${l.label}` : l.label}
              </button>
            );
          })}
        </div>
        {activityOpen && (
          <div id="link-activity" className="mt-3 max-w-2xl">
            <ActivityUpload
              onResult={(found, from) => {
                setAmounts((a) => ({ ...a, ...found }));
                if ("ai" in found) resetAiCover();
                setEntered((e) => ({ ...e, ...Object.fromEntries(Object.keys(found).map((k) => [k, false])) }));
                setLinkedFrom((l) => ({ ...l, ...from }));
              }}
            />
          </div>
        )}
        {asked.length > 0 && (
          <p className="text-muted">
            Linking your {asked.map((a) => providerName(a).toLowerCase()).join(" and ")} opens at launch. Until then we use
            typical amounts for {STATES[ctx.state].name}.
          </p>
        )}
      </section>

      {/* The aisle bar sticks only while the shelves are on screen. */}
      <div>
      <nav aria-label="Aisles" className="sticky top-0 z-20 -mx-4 mb-8 border-b-2 border-rule bg-background px-4">
        <ul className="flex gap-1 overflow-x-auto py-2 text-sm font-semibold [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <a href={`#section-${s.key}`} className="inline-flex min-h-10 items-center rounded-md px-3 whitespace-nowrap hover:bg-card">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((s) => {
        const items = PRODUCTS.filter((p) => p.section === s.key);
        if (!items.length) return null;
        const collapsed = !expanded[s.key];
        // Keep an open item's details visible even if the shelf is collapsed.
        const openItem = items.find((p) => p.id === details);
        return (
          <section key={s.key} id={`section-${s.key}`} className="mb-10 scroll-mt-16" aria-labelledby={`heading-${s.key}`}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <h2 id={`heading-${s.key}`} className="text-2xl font-bold">
                  {s.title}
                </h2>
                <p className="text-sm text-muted">{s.blurb}</p>
              </div>
              {items.length > SHELF_SIZE && (
                <button
                  type="button"
                  onClick={() => setExpanded((x) => ({ ...x, [s.key]: !x[s.key] }))}
                  className="hidden min-h-10 shrink-0 items-center text-sm font-semibold underline underline-offset-4 md:inline-flex"
                >
                  {collapsed ? `See all ${items.length}` : "See fewer"}
                </button>
              )}
            </div>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
              {items.map((p, i) => tile(p, i, collapsed))}
            </ul>
            {openItem && detailPanel(openItem)}
            {(s.key === "online" || s.key === "devices") && (
              <p className="mt-2 text-xs text-muted">
                {s.key === "online"
                  ? "Video and music can be measured from your YouTube, Netflix or Spotify history; the rest start from typical use."
                  : "No account can measure this yet, so it starts from typical use."}
                {s.key === "devices" && " Includes paying to reuse or recycle each one when you replace it."}
              </p>
            )}
          </section>
        );
      })}
      </div>

      {plan.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-rule bg-background">
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
                    <li key={l.productId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <span>
                        <span className="font-medium">{l.product.name}</span>{" "}
                        <span className="text-muted">· {coverBadge(l.cover, billing)}</span>
                        {l.product.oneTime && (
                          <label className="ml-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-muted">
                            <input
                              type="checkbox"
                              checked={l.cover.past}
                              onChange={(e) => setPast(l.productId, e.target.checked)}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                            past use
                          </label>
                        )}
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
                <button
                  type="button"
                  onClick={() => setAdjusting((a) => !a)}
                  aria-expanded={adjusting}
                  className="mt-2 min-h-10 text-sm text-muted underline hover:text-foreground"
                >
                  {adjusting ? "Done adjusting" : "Adjust past use, age and state"}
                </button>
                {adjusting && (
                <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pastAll}
                      onChange={(e) => setPastAll(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="font-medium">Include past use</span>
                      <span className="text-muted"> on every item that has it</span>
                    </span>
                  </label>
                  <label className="block">
                    <span className="block text-muted">Born in</span>
                    <span className="mt-1 block w-24">
                      <NumberInput
                        label="Birth year"
                        min={1900}
                        value={ctx.birthYear}
                        onChange={(n) => setCtx((c) => ({ ...c, birthYear: n ?? DEFAULT_CONTEXT.birthYear }))}
                      />
                    </span>
                  </label>
                  {ctx.aiPastWh === undefined && (
                    <label className="block w-36">
                      <span className="block text-muted">Using AI since</span>
                      <span className="mt-1 block">
                        <Select
                          label="Using AI since"
                          value={String(ctx.aiStartYear ?? 2022)}
                          onChange={(v) => setCtx((c) => ({ ...c, aiStartYear: Number(v) === 2022 ? undefined : Number(v) }))}
                          options={AI_START_OPTIONS}
                        />
                      </span>
                    </label>
                  )}
                  <label className="block w-48">
                    <span className="block text-muted">State</span>
                    <span className="mt-1 block">
                      <Select
                        label="State"
                        value={ctx.state}
                        onChange={(v) => setCtx((c) => ({ ...c, state: v as StateCode, statePicked: true }))}
                        options={STATE_OPTIONS.map((s) => ({ value: s.code, label: s.name }))}
                      />
                    </span>
                  </label>
                  <p className="max-w-56 text-xs text-muted">
                    Age sets how many years lifetime covers; state sets how clean your power is.
                    {ctx.aiPastWh === undefined && " Linking an AI account replaces the start year with your real history."}
                  </p>
                </div>
                )}
                <div className="mt-3 flex border-t border-border pt-3 flex-wrap items-center gap-2 text-sm" role="radiogroup" aria-label="Optional tip">
                  <span className="text-muted">
                    Add a tip to help keep Offset running?{" "}
                    <a href="/ledger#tips" target="_blank" className="underline hover:text-foreground">
                      What tips pay for
                    </a>
                  </span>
                  {TIPS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={tip === t}
                      onClick={() => setTip(t)}
                      className={`figures min-h-10 rounded-md border px-3 ${
                        tip === t ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"
                      }`}
                    >
                      {t ? usd(t).replace(".00", "") : "No tip"}
                    </button>
                  ))}
                </div>
                <dl className="figures mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  {totals.oneTime && (
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">Donation, one time</dt>
                      <dd>{usd(totals.oneTime.donation)}</dd>
                    </div>
                  )}
                  {totals.recurring && (
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">Donation, first {billing === "annual" ? "year" : "month"}</dt>
                      <dd>{usd(totals.recurring.donation)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="font-sans text-muted">Card fee (30¢ + 3.6%, none of it to us)</dt>
                    <dd>{usd((totals.oneTime?.fee ?? 0) + (totals.recurring?.fee ?? 0))}</dd>
                  </div>
                  {tip > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">Tip to keep Offset running</dt>
                      <dd>{usd(tip)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
                    <dt className="font-sans">Total today</dt>
                    <dd>{usd(dueToday)}</dd>
                  </div>
                  {totals.recurring && (
                    <p className="font-sans text-muted">
                      Then {usd(totals.recurring.total)} {BILLING[billing].per} ({usd(totals.recurring.donation)} donation +{" "}
                      {usd(totals.recurring.fee)} card fee). Cancel anytime.
                    </p>
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
                        {b === "annual" && " (one card fee a year)"}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  The smallest donation is {usd(MIN_DONATION_USD)}. We pool small donations and send each charity one payment a
                  month, so none is lost to card fees. You approve each payment yourself, unless you choose autopay, and even then we email you before every charge.
                </p>
                {checkout && (
                  <p className="mt-4 text-sm text-muted">Payments aren&apos;t switched on yet. Your plan stays saved in this browser until they are.</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-1.5">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex min-h-11 flex-wrap items-baseline gap-x-3 text-left text-sm"
              >
                <span className="font-semibold">
                  {open ? "▾" : "▴"} Your plan · {plan.length}
                </span>
                <span className="figures text-muted">
                  {[
                    `${usd(dueToday)} today`,
                    totals.recurring && `then ${usd(totals.recurring.total)}${billing === "annual" ? "/yr" : "/mo"}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setCheckout(true);
                }}
                className="min-h-11 shrink-0 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
              >
                Review and pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
