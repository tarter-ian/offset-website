"use client";

import { AGENT_TOOL_NAMES } from "@/lib/ai/signin";
import Link from "next/link";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import { recordStatus } from "@/lib/record";
import { steadyPlan } from "@/lib/steady";
import { pullCovered, pushCovered } from "@/lib/accountClient";
import { useEffect, useRef, useState } from "react";
import { ActivityUpload } from "./ActivityUpload";
import { CheckoutSteps } from "./Checkout";
import { SteadyCheck } from "./SteadyCheck";
import { LIFETIME_TO_AGE } from "@/lib/factors";
import { joinList, ListInvite, ListOptIn } from "./ListOptIn";
import { AiExportUpload } from "./AiExportUpload";
import { AiQuickPick } from "./AiQuickPick";
import { OffsetTimeline } from "./OffsetTimeline";
import { AI_LEVELS } from "@/lib/ai/levels";
import { NumberInput, Select } from "./fields";
import { STATE_OPTIONS, STATES, type StateCode } from "@/lib/data/states";
import { airShort, IMPACT_INFO, lifeText } from "@/lib/impacts";
import { CHARITIES } from "@/lib/charities";
import { IMPACT_KEYS, type ImpactKey, sumImpacts, type Impacts } from "@/lib/footprint";
import { howEstimated, whereItGoes } from "@/lib/methods";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  allConfirmed,
  chargeSummary,
  charityName,
  type Checkout,
  forMode,
  type FundGift,
  fundGifts,
  fundLink,
  harmsText,
  loadCheckout,
  newPlanId,
  type PayRow,
  PAYMENT_MODE,
  paymentsOn,
  bestPastYears,
  payRows,
  repeatRows,
  saveCheckout,
  sumTotal,
} from "@/lib/payments";
import { digitalFromExport } from "@/lib/ai/exportParser";
import { aiMonthTotals, shareLines, shareQuery, type ShareTotals } from "@/lib/share";
import { SOURCE_NAMES, type ActivitySource } from "@/lib/activity";
import { ONLINE_FROM_AGE } from "@/lib/factors";
import {
  LIFETIME_GROWTH_BUFFER,
  BILLING,
  type Billing,
  DEFAULT_BILLING,
  MIN_DONATION_USD,
  CARD_FEE_LABEL,
  SPONSOR_FEE_LABEL,
  ENDAOMENT_CARD_LABEL,
  ENDAOMENT_GRANT_LABEL,
  ENDAOMENT_IN_LABEL,
  feeParts,
  impactCost,
  usd,
} from "@/lib/pricing";
import {
  aheadFor,
  SMALL_MONTHLY_USD,
  AI_LIFETIME_FIRST_MAX_USD,
  BEFORE_GROUPS,
  lifestyleBadge,
  codingMeasured,
  type Cover,
  coverBadge,
  coverPrice,
  DEFAULT_CONTEXT,
  defaultAmount,
  effectiveCover,
  everydaySince,
  PAST_FROM_AGE,
  PRODUCTS,
  planTotals,
  harmSplit,
  SECTIONS,
  coverImpacts,
  sourcesFor,
  productById,
  yearlyLine,
  PAST_YEARS,
  type Before,
  type Context,
  type PastYears,
  type PlanLine,
  type Product,
} from "@/lib/store";

interface Saved {
  ctx: Context;
  amounts: Record<string, number | string>;
  picked: Record<string, Partial<Cover>>;
  anyway: Record<string, boolean>;
  plan: string[];
  billing?: Billing | null;
  entered?: Record<string, boolean>;
  pastAll?: boolean;
  pastYears?: PastYears | null;
  pastEveryday?: boolean;
  linkedFrom?: Record<string, ActivitySource[]>;
  covered?: Record<string, Covered>;
}

/** `?preview=covered` shows how paid items look, without saving anything. */
function previewCovered(): Record<string, Covered> | null {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("preview") !== "covered") return null;
  const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
  return { ai: { kind: "life" }, phone: { kind: "life" }, video: { kind: "period", until: inDays(30) }, electricity: { kind: "period", until: inDays(300) } };
}

const paidCover = (c: Covered | undefined): Covered | null =>
  !c ? null : c.kind === "life" ? c : Date.parse(c.until) > Date.now() ? c : null;

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const once = (n: number) => usd(Math.max(0.01, Math.ceil(n * 100) / 100));
const per = (monthly: number, billing: Billing) => `${usd(billing === "annual" ? monthly * 12 : monthly)} ${BILLING[billing].per}`;
function priceText(price: { once: number; monthly: number }, cover: Cover, billing: Billing) {
  const parts = [];
  if (price.once > 0) parts.push(`${once(price.once)} ${cover.past && cover.ahead === "lifetime" ? "for life" : "once"}`);
  if (cover.ahead === "monthly" && !(price.once > 0 && price.monthly < 0.005)) parts.push(per(price.monthly, billing));
  return parts.join(" + ");
}
/** Fits a store tile: a big figure with a small note, e.g. "$4.75" / "for life" or "$80.74" / "+ $0.34 a month". */
/** A tile's price: the monthly price first, unless the item is set to be paid once for life. */
function tilePrice(price: { once: number; monthly: number }, cover: Cover, billing: Billing, spreadYears = 0) {
  const ongoing = usd(billing === "annual" ? price.monthly * 12 : price.monthly);
  const per = BILLING[billing].per;
  if (cover.ahead === "monthly") {
    if (!(price.once > 0)) return { big: ongoing, note: per };
    // Nothing going forward, like meat after going vegan: only the past is left to pay.
    if (price.monthly < 0.005)
      return spreadYears
        ? { big: usd((billing === "annual" ? 12 : 1) * (price.once / (spreadYears * 12))), note: `${per} for ${spreadYears} year${spreadYears > 1 ? "s" : ""}, for past use` }
        : { big: once(price.once), note: "once, for past use" };
    const past = spreadYears
      ? `${usd((billing === "annual" ? 12 : 1) * (price.once / (spreadYears * 12)))} ${per} for ${spreadYears} year${spreadYears > 1 ? "s" : ""}`
      : `${once(price.once)} once`;
    return { big: ongoing, note: `${per} + ${past} for past use` };
  }
  return { big: once(price.once), note: cover.past ? "once, for life" : "once, for all future use" };
}
/** Past use above this is always spread over years, never asked for at once. */
const PAST_ALL_NOW_MAX_USD = 100;
/** Every kind of harm covered, skipping ones too small to show, e.g. "181 kg CO₂e · air 7.7 min · 947 L water". */
const MIN_SHOWN: Record<ImpactKey, number> = { carbon: 0.005, air: 0.0005, water: 0.05, land: 0.001, ewaste: 0.01 };
const coversText = (i: Impacts, long = false) =>
  IMPACT_KEYS.filter((k) => i[k] >= MIN_SHOWN[k])
    .map((k) =>
      k !== "air"
        ? IMPACT_INFO[k].format(i[k], i)
        : long
          ? `${airShort(i)} (about ${lifeText(i[k])} of healthy life)`
          : `air ${airShort(i)}`,
    )
    .join(" · ");

/**
 * One plain outcome for a tile, led by the harm (other than air) that takes most of the money, e.g.
 * "Keeps 151 kg of CO₂ out of the air, plus clean air, water and nature". The full
 * figures are in the tile's (i) (Ian, 2026-10-12).
 */
const OUTCOME: Record<ImpactKey, (i: Impacts) => string> = {
  carbon: (i) => `Keeps ${IMPACT_INFO.carbon.format(i.carbon, i).replace(" CO₂e", "")} of CO₂ out of the air`,
  air: () => "Pays for cleaner air where the pollution lands",
  water: (i) => `Puts ${IMPACT_INFO.water.format(i.water, i).replace(" L water", " L")} of water back in dry rivers`,
  land: (i) => `Protects ${IMPACT_INFO.land.format(i.land, i).replace(" land", "")} of forest`,
  ewaste: (i) => `Recycles ${IMPACT_INFO.ewaste.format(i.ewaste, i).replace(" e-waste", "")} of old electronics`,
};
const OUTCOME_SHORT: Record<ImpactKey, string> = { carbon: "climate", air: "clean air", water: "water", land: "nature", ewaste: "e-waste" };
const outcomeText = (i: Impacts) => {
  const cost = impactCost(i);
  const shown = IMPACT_KEYS.filter((k) => i[k] >= MIN_SHOWN[k]);
  if (!shown.length) return "";
  // Air pollution has no concrete thing to point to, so it never leads; climate does unless another harm costs more.
  const leads = shown.filter((k) => k !== "air");
  if (!leads.length) return `${OUTCOME.air(i)}`;
  const lead = leads.reduce((a, b) => (cost[b] > cost[a] ? b : a));
  const rest = shown.filter((k) => k !== lead).map((k) => OUTCOME_SHORT[k]);
  const tail = rest.length > 1 ? `${rest.slice(0, -1).join(", ")} and ${rest.at(-1)}` : rest[0];
  return OUTCOME[lead](i) + (tail ? `, plus ${tail}` : "");
};

const amountText = (p: Product, amount: number | string) =>
  p.amount.kind === "number"
    ? `${p.amount.prefix ?? ""}${typeof amount === "number" ? amount.toLocaleString("en-US") : amount} ${
        amount === 1 ? p.amount.unit.replace(/^(image|video)s/, "$1").replace(/^(hour|mile|prompt)s/, "$1").replace("round trips", "round trip") : p.amount.unit
      }`
    : (p.amount.options.find((o) => o.value === amount)?.label ?? String(amount));
const providerName = (id: ProviderId) => PROVIDERS.find((x) => x.id === id)?.name ?? id;
/**
 * What a new visitor sees first in each aisle: the things most people have,
 * at friendly prices. Cards measured from an account move ahead of these.
 */
const COMMON_FIRST: Partial<Record<string, string[]>> = {
  online: ["video", "social", "music"],
  devices: ["phone", "laptop", "tv"],
  travel: ["car", "flights", "rideshare"],
};
const LIVE_LINKS = new Set<ProviderId>(["chatgpt", "claude", "gemini", "openai-api", "anthropic-api", "activity"]);


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
  const [updatingNumbers, setUpdatingNumbers] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [asked, setAsked] = useState<ProviderId[]>([]);
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [covered, setCovered] = useState<Record<string, Covered>>({});
  // Gifts through Every.org repeat on their own only if the person ticks this.
  const [autopay, setAutopay] = useState(false);
  // Progress through paying each charity, kept in this browser.
  const [payState, setPayState] = useState<Checkout | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  // Which downloaded histories filled in each tile's amount.
  const [linkedFrom, setLinkedFrom] = useState<Record<string, ActivitySource[]>>({});
  /** Amazon dollars a month for shopping cards that kept the typical amount because it was higher. */
  const [amazonBelow, setAmazonBelow] = useState<Record<string, number>>({});
  // Past use is one switch for the whole plan; an item can still be changed on its own.
  const [pastAll, setPastAllState] = useState(true);
  // Null until picked: then the spread follows the amount.
  const [pastYears, setPastYears] = useState<PastYears | null>(null);
  const [pastEveryday, setPastEverydayState] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** The aisles stay folded until someone asks for them, so the first visit is about AI alone. */
  const [shelvesOpen, setShelvesOpen] = useState(false);
  // Nothing is saved until the saved plan has loaded, so the first render's empty state never
  // overwrites it, and nothing at all while the page is leaving for the record.
  const [ready, setReady] = useState(false);

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
    // A link straight to an aisle opens the folded aisles and goes there.
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("section-") || hash === "everything-heading") {
      setShelvesOpen(true);
      setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 150);
    }
    if (!s) {
      setReady(true);
      return;
    }
    // Anyone who has covered something lands on their record, unless they came to the store on purpose.
    const q = new URLSearchParams(window.location.search);
    if (!q.has("store") && !q.has("preview") && recordStatus(s.covered ?? {}).kind !== "none") {
      window.location.replace("/record");
      return;
    }
    setCtx({ ...DEFAULT_CONTEXT, ...s.ctx });
    // Drop saved amounts of the wrong kind, like a shopping level saved before those cards took dollars.
    setAmounts(
      Object.fromEntries(
        Object.entries(s.amounts ?? {}).filter(([id, v]) => {
          const p = productById(id);
          return !p || (p.amount.kind === "number") === (typeof v === "number");
        }),
      ),
    );
    setEntered(s.entered ?? {});
    setPicked(withoutAhead(s.picked ?? {}, (id) => !(s.plan ?? []).includes(id)));
    setAnyway(s.anyway ?? {});
    setPlan(s.plan ?? []);
    setBilling(s.billing ?? null);
    setPastAllState(s.pastAll ?? true);
    setPastYears(s.pastYears != null && PAST_YEARS.includes(s.pastYears) ? s.pastYears : null);
    setPastEverydayState(s.pastEveryday ?? false);
    setLinkedFrom(s.linkedFrom ?? {});
    setCovered(s.covered ?? {});
    setReady(true);
    // From the record page's "Cover the next month": just the items whose month ran out, straight to checkout.
    const renew = (q.get("renew") ?? "").split(",").filter((id) => productById(id));
    if (renew.length) {
      setPlan(renew);
      setPicked((p) => ({ ...p, ...Object.fromEntries(renew.map((id) => [id, { ...p[id], ahead: "monthly" as const }])) }));
      setOpen(true);
      setCheckout(true);
      setTimeout(() => document.getElementById("pay-steps")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, []);

  useEffect(() => setPayState(loadCheckout()), []);

  // Signed in: what the account covers (from another device) shows here too, and new covers go up to it.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    pullCovered().then((merged) => {
      if (!merged) return;
      setSignedIn(true);
      setCovered(merged);
    });
  }, []);
  useEffect(() => {
    if (signedIn && !previewing) void pushCovered(covered);
  }, [signedIn, covered, previewing]);

  // Once Every.org has confirmed every gift of a checkout, mark what it paid for as covered.
  useEffect(() => {
    if (!payState || payState.applied || !allConfirmed(payState)) return;
    const from = new Date(payState.created);
    const until = new Date(from);
    if (payState.billing === "annual") until.setFullYear(until.getFullYear() + 1);
    else until.setMonth(until.getMonth() + 1);
    setCovered((c) => ({
      ...c,
      ...Object.fromEntries(
        payState.lines.map((l): [string, Covered] => [
          l.productId,
          {
            ...(l.lifetime ? { kind: "life" as const } : { kind: "period" as const, until: until.toISOString() }),
            since: c[l.productId]?.since ?? payState.created,
            ...(l.past !== undefined ? { past: l.past || !!c[l.productId]?.past } : {}),
          },
        ]),
      ),
    }));
    const applied = { ...payState, applied: true };
    saveCheckout(applied);
    setPayState(applied);
  }, [payState]);

  useEffect(() => {
    const preview = previewCovered();
    if (preview) {
      setPreviewing(true);
      setCovered(preview);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ctx, amounts, entered, picked, anyway, plan, billing: billingPick, pastAll, pastYears, pastEveryday, linkedFrom, ...(previewing ? {} : { covered }) } satisfies Saved),
      );
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [ready, ctx, amounts, entered, picked, anyway, plan, billingPick, pastAll, pastYears, pastEveryday, linkedFrom, covered, previewing]);

  const amountOf = (p: Product) => amounts[p.id] ?? defaultAmount(p, ctx);
  const coverOf = (p: Product) => effectiveCover(p, amountOf(p), ctx, { past: p.oneTime ? pastAll : pastEveryday, ...picked[p.id] }, anyway[p.id]);
  /** Sets past use for a whole kind of item, clearing one-off picks on those items. */
  const clearPast = (oneTime: boolean) =>
    setPicked((x) => Object.fromEntries(Object.entries(x).map(([id, c]) => [id, productById(id)?.oneTime === oneTime ? { ...c, past: undefined } : c])));
  const setPastAll = (v: boolean) => {
    setPastAllState(v);
    clearPast(true);
  };
  const setPastEveryday = (v: boolean) => {
    setPastEverydayState(v);
    clearPast(false);
  };
  const setPast = (id: string, v: boolean) => setPicked((x) => ({ ...x, [id]: { ...x[id], past: v } }));
  const lines = plan.map((id) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    return { productId: id, amount: amountOf(p), cover: coverOf(p) };
  });
  const billing = billingPick ?? DEFAULT_BILLING;
  const pastTotal = lines.reduce((sum, l) => sum + (l.cover.past && l.cover.ahead === "monthly" ? productById(l.productId)!.cost(l.amount, "past", ctx) : 0), 0);
  // "All now" is only offered while past use stays small; a big past-use sum is always spread (Ian, 2026-10-13).
  const allNowOk = (usd: number) => usd <= PAST_ALL_NOW_MAX_USD;
  const pastPick = (pastUsd: number) => (pastYears === 0 && !allNowOk(pastUsd) ? null : pastYears);
  const spreadYears = pastPick(pastTotal) ?? bestPastYears(lines, ctx, billing);
  const totals = planTotals(lines, ctx, billing, spreadYears);
  // When the last past-use instalment is due, for the autopay note.
  const pastEnds = totals.pastSpread
    ? new Date(new Date().setMonth(new Date().getMonth() + totals.pastSpread.years * 12)).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;
  // Through Every.org, each charity is its own payment with its own card fee.
  const every = PAYMENT_MODE === "every";
  const split = harmSplit(totals, ctx, billing);
  const giftRows = payRows(split, billing, autopay);
  const repeatTotal = sumTotal(repeatRows(split, billing));
  // Through Endaoment, one gift to the fund covers every charity.
  const fund = PAYMENT_MODE === "endaoment" ? fundGifts(split) : null;
  // Everything charged today: the one-time payment and the first ongoing payment.
  const charged = PAYMENT_MODE === "sponsor" ? null : chargeSummary(split, billing, autopay);
  const dueToday = charged ? charged.today : (totals.oneTime?.total ?? 0) + (totals.recurring?.total ?? 0);
  const thenTotal = charged ? charged.then : (totals.recurring?.total ?? 0);
  // Room below the footer for the plan bar, so it never covers the last lines of the page.
  useEffect(() => {
    document.body.style.paddingBottom = plan.length ? "5rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [plan.length]);

  // A tile left out of the plan goes back to its own default, so a monthly pick from Add all
  // doesn't stick to small items after they're removed (Ian, 2026-10-13).
  const planBefore = useRef<string[]>([]);
  useEffect(() => {
    const gone = planBefore.current.filter((id) => !plan.includes(id));
    planBefore.current = plan;
    if (gone.length) setPicked((x) => withoutAhead(x, (id) => gone.includes(id)));
  }, [plan]);
  const toggle = (id: string) => setPlan((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  /** Items worth adding in a group: everything with something to cover at its current amount. */
  const addable = (ps: Product[]) =>
    ps.filter((p) => {
      if (paidCover(covered[p.id])) return false;
      const c = coverPrice(p, amountOf(p), coverOf(p), ctx);
      return c.once + c.monthly > 0;
    });
  const addAll = (ps: Product[]) => setPlan((cur) => [...cur, ...addable(ps).map((p) => p.id).filter((id) => !cur.includes(id))]);
  /** Monthly wherever it's offered, so adding a group never leads with a big one-time charge (Ian, 2026-10-13). */
  const monthlyCover = (p: Product): Cover => {
    const c = coverOf(p);
    return plan.includes(p.id) || !aheadFor(p, amountOf(p), ctx, anyway[p.id]).includes("monthly") ? c : { ...c, ahead: "monthly" };
  };
  const addGroup = (ps: Product[]) => {
    const ids = addable(ps).filter((p) => !plan.includes(p.id) && monthlyCover(p).ahead === "monthly").map((p) => p.id);
    setPicked((x) => ({ ...x, ...Object.fromEntries(ids.map((id) => [id, { ...x[id], ahead: "monthly" as const }])) }));
    addAll(ps);
  };
  /**
   * Cover everything starts every item it adds on monthly, small ones too, so it reads as one monthly price,
   * and shows what checkout will: card fees and the past-use instalment included (Ian, 2026-10-12).
   */
  const everything = (() => {
    const evLines = addable(PRODUCTS).map((p) => ({
      productId: p.id,
      amount: amountOf(p),
      cover: { past: coverOf(p).past, ahead: plan.includes(p.id) ? coverOf(p).ahead : ("monthly" as const) },
    }));
    const years = pastPick(Infinity) ?? bestPastYears(evLines, ctx, billing);
    const t = planTotals(evLines, ctx, billing, years);
    return { ...chargeSummary(harmSplit(t, ctx, billing), billing, autopay), spread: t.pastSpread };
  })();
  const addEverything = () => {
    const ids = addable(PRODUCTS).map((p) => p.id);
    setPicked((x) => ({ ...x, ...Object.fromEntries(ids.map((id) => [id, { ...x[id], ahead: "monthly" as const }])) }));
    addAll(PRODUCTS);
  };
  /** e.g. "$9 a month, past use spread over 3 years": each item monthly, past use in instalments as checkout would. */
  const groupPrice = (ps: Product[]) => {
    const gLines = addable(ps).map((p) => ({ productId: p.id, amount: amountOf(p), cover: monthlyCover(p) }));
    const t = planTotals(gLines, ctx, billing, pastPick(Infinity) ?? bestPastYears(gLines, ctx, billing));
    const monthly = t.lines.reduce((s, l) => s + (l.cover.ahead === "monthly" ? l.aheadCost : 0), 0) + (t.pastSpread?.perMonth ?? 0);
    const onceSum = t.lines.reduce((s, l) => s + (l.cover.ahead === "lifetime" ? l.aheadCost + l.pastCost : t.pastSpread ? 0 : l.pastCost), 0);
    return [
      monthly > 0 && per(monthly, billing),
      onceSum > 0 && `${once(onceSum)} once`,
    ]
      .filter(Boolean)
      .join(" + ") + (t.pastSpread ? `, past use spread over ${t.pastSpread.years === 1 ? "a year" : `${t.pastSpread.years} years`}` : "");
  };
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
    if (src !== "activity") return `Link your ${providerName(src).toLowerCase()}`;
    if (p.id === "music") return "Add your Spotify or YouTube history";
    if (p.id === "video") return "Add your YouTube or Netflix history";
    if (p.section === "home") return "Add your utility's Green Button download";
    return "Add your Google Maps Timeline";
  };

  /** An amount the extension measured, labelled with where it came from. */
  const measuredAmount = (id: string, n: number, from: ActivitySource[]) => {
    setAmounts((a) => ({ ...a, [id]: n }));
    setEntered((e) => ({ ...e, [id]: false }));
    setLinkedFrom((l) => ({ ...l, [id]: from }));
  };

  /**
   * Amazon is only part of what people buy, so a card takes Amazon's figure
   * only when it's above the typical amount; otherwise it keeps the typical one.
   */
  const amazonShopping = (usd: Partial<Record<string, number>>) => {
    for (const id of ["clothing", "electronics", "household", "othergoods"]) {
      if (entered[id]) continue;
      const amazon = Math.round(usd[id] ?? 0);
      const p = productById(id);
      const typical = p?.amount.kind === "number" ? p.amount.default : 0;
      if (amazon >= typical) {
        measuredAmount(id, amazon, ["amazon"]);
        setAmazonBelow((b) => { const n = { ...b }; delete n[id]; return n; });
      } else {
        setAmounts((a) => ({ ...a, [id]: typical }));
        setLinkedFrom((l) => { const n = { ...l }; delete n[id]; return n; });
        setAmazonBelow((b) => ({ ...b, [id]: amazon }));
      }
    }
  };

  const sourceNote = (p: Product) => {
    if (entered[p.id]) return "you entered";
    if (p.id === "ai-coding" && codingMeasured(ctx))
      return [
        ctx.aiCode && `Claude Code, estimated from ${Math.round(ctx.aiCode.limitPercent)}% of your ${ctx.aiCode.plan} weekly limit`,
        ctx.aiAgent && `${AGENT_TOOL_NAMES[ctx.aiAgent.tool ?? "both"]}, from its token total`,
      ]
        .filter(Boolean)
        .join(", plus ");
    if (p.section === "ai" && ctx.aiFromExport) return "measured from your account";
    if (p.id === "ai" && ctx.aiEstimate) return ctx.aiEstimate.from;
    if ((p.id === "ai-media" || p.id === "ai-video") && ctx.aiEstimate?.level) return ctx.aiEstimate.from;
    if (linkedFrom[p.id]) return `from your ${linkedFrom[p.id].map((s) => SOURCE_NAMES[s]).join(" and ")} history`;
    if (amazonBelow[p.id] !== undefined) return `typical, more than the $${amazonBelow[p.id]} a month you spend on Amazon`;
    if (p.id === "electricity") return `typical for ${STATES[ctx.state].name}`;
    return "typical";
  };

  /** Amount, where it came from, and the way to replace it: link first, typing second. */
  const amountLine = (p: Product) => {
    const amount = amountOf(p);
    // Only links that work today: utility, bank and car linking wait on their providers' keys.
    const sources = sourcesFor(p).filter((s) => LIVE_LINKS.has(s));
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
          {sources.length > 0 && !fromAccount && p.section !== "ai" && (
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
    if (!p.oneTime)
      return ctx.before?.[p.id] && ctx.before[p.id].until > everydaySince(ctx)
        ? `your old habits from ${everydaySince(ctx)}, today's since ${ctx.before[p.id].until}`
        : `today's habits since ${everydaySince(ctx)}`;
    return `today's rate since you were ${ONLINE_FROM_AGE}, or 1995`;
  };

  /** Past use is a checkbox; going forward is ongoing or lifetime, one or the other. */
  const coverControls = (p: Product, withPast = false) => {
    if (!p.oneTime && !withPast) return null;
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
            Include past use <span className="amount text-muted">({once(pastPrice)})</span>
            {p.id !== "ai" && <span className="text-muted"> · {pastNote(p)}</span>}
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
                  cover.ahead === a ? "border-rule bg-foreground text-background" : "border-rule hover:bg-card"
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
        {withPast && options.length > 1 && (
          <p className="text-muted">
            {cover.ahead === "lifetime"
              ? "Best if you'd rather pay once and be done."
              : billing === "annual"
                ? "Best if your use is steady: one payment a year."
                : "Best if your use changes: pay for each month as it comes."}
          </p>
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
  const coversLines = (p: Product, long = false): [string, string][] => {
    const cover = coverOf(p);
    const c = coverImpacts(p, amountOf(p), cover, ctx);
    const lines: [string, string][] = [];
    if (cover.ahead === "lifetime") lines.push([cover.past ? "Offsets for life" : "Offsets all future use", coversText(c.once, long)]);
    else {
      if (cover.past) lines.push(["Offsets past use", coversText(c.once, long)]);
      const k = billing === "annual" ? 12 : 1;
      lines.push([
        billing === "annual" ? "Offsets each year" : "Offsets each month",
        coversText(
          {
            carbon: c.monthly.carbon * k,
            air: c.monthly.air * k,
            water: c.monthly.water * k,
            land: c.monthly.land * k,
            ewaste: c.monthly.ewaste * k,
            smogL: c.monthly.smogL * k,
            sootG: c.monthly.sootG * k,
          },
          long,
        ),
      ]);
    }
    return lines;
  };

  /** What a tile's big price covers: everything for life, or one month or year. */
  const tileImpacts = (p: Product): Impacts => {
    const cover = coverOf(p);
    const c = coverImpacts(p, amountOf(p), cover, ctx);
    if (cover.ahead === "lifetime") return c.once;
    const k = billing === "annual" ? 12 : 1;
    return {
      carbon: c.monthly.carbon * k,
      air: c.monthly.air * k,
      water: c.monthly.water * k,
      land: c.monthly.land * k,
      ewaste: c.monthly.ewaste * k,
      smogL: c.monthly.smogL * k,
      sootG: c.monthly.sootG * k,
    };
  };

  const summaryCls = "flex min-h-10 cursor-pointer list-none items-center justify-between font-bold [&::-webkit-details-marker]:hidden after:content-['+'] after:text-lg after:font-normal [[open]>&]:after:content-['−']";
  /** The (i) panel over a tile, folded into three parts (Ian, 2026-10-13): what it covers, how it's estimated, who gets the money. */
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
        <details open className="border-t border-border py-2">
          <summary className={summaryCls}>What it covers</summary>
          {coversLines(p, true)
            .filter((l) => l[1])
            .map(([label, text]) => (
              <div key={label} className="mt-2">
                <p className="font-semibold">{label}</p>
                <ul className="mt-1 space-y-1 text-muted">
                  {text.split(" · ").map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ul>
              </div>
            ))}
        </details>
        <details className="border-t border-border py-2">
          <summary className={summaryCls}>How we estimate it</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
            {howEstimated(p).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <details className="border-y border-border py-2">
          <summary className={summaryCls}>Where the money goes</summary>
          <ul className="mt-2 space-y-1">
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
        </details>
        <p className="mt-2 text-xs text-muted">
          <a href="/method" className="underline">Full method and sources</a>
        </p>
      </div>
    );
  };

  /** A store tile: what it is, why it matters, your amount, the price and a one-tap add. Details open below the shelf. */
  const tile = (p: Product) => {
    const amount = amountOf(p);
    const cover = coverOf(p);
    const price = coverPrice(p, amount, cover, ctx);
    // A card not in the plan yet shows the spread its past use would get if added.
    const cardSpread =
      pastPick(price.once) ??
      (plan.includes(p.id) || !cover.past || cover.ahead !== "monthly" ? spreadYears : bestPastYears([...lines, { productId: p.id, amount, cover }], ctx, billing));
    const tp = tilePrice(price, cover, billing, cardSpread);
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
    const paid = paidCover(covered[p.id]);
    // A lifestyle choice that leaves nothing to pay going forward, like meat on a vegan diet, counts as covered.
    const lifestyle = !paid && coverPrice(p, amount, { past: false, ahead: "monthly" }, ctx).monthly < 0.005 ? lifestyleBadge(p, amount) : null;
    return (
      <li
        key={p.id}
        className={`flex w-[78%] shrink-0 snap-start flex-col rounded-md p-4 md:w-auto ${
          paid?.kind === "life" || lifestyle ? "bg-life" : paid ? "bg-period" : plan.includes(p.id) ? "bg-accent-soft" : "bg-card"
        } ${isOpen ? "outline-2 outline-rule" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold leading-snug">{p.name}</h3>
            {paid && (
              <p className={`text-sm font-semibold ${paid.kind === "life" ? "text-life-ink" : "text-period-ink"}`}>
                ✓{" "}
                {paid.kind === "life"
                  ? "Offset for life"
                  : `Offset through ${shortDate(paid.until)}`}
                {paid.giftFrom && `, a gift from ${paid.giftFrom}`}
              </p>
            )}
            {lifestyle && <p className="text-sm font-semibold text-life-ink">✓ {lifestyle}</p>}
          </div>
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
            ? lifestyle
              ? "Nothing to offset going forward."
              : p.section === "food"
              ? `Nothing to offset on a ${amountText(p, amount).toLowerCase()} diet.`
              : "Nothing to offset at this amount."
            : outcomeText(tileImpacts(p))}
        </p>
        {info === p.id && infoPanel(p)}
        {paid?.kind === "life" ? (
          <p className="mt-auto pt-3 text-sm text-life-ink">All done. Nothing more to pay for this, ever.</p>
        ) : !nothing && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <span className="leading-tight">
            <span className="amount block text-lg font-semibold">{tp.big}</span>
            <span className="block text-xs text-muted">{tp.note}</span>
          </span>
          {addButton(p, true)}
        </div>
        )}
        {alt && !nothing && paid?.kind !== "life" && (
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

  /** Past use when a habit changed: "Until 2021 I ate meat at most meals", priced at the old habit before that year. */
  const setBefore = (p: Product, b: Before | undefined) =>
    setCtx((c) => {
      const before = { ...c.before };
      for (const id of BEFORE_GROUPS[p.id] ?? [p.id]) {
        if (b) before[id] = b;
        else delete before[id];
      }
      return { ...c, before: Object.keys(before).length ? before : undefined };
    });
  const beforeLine = (p: Product) => {
    const b = ctx.before?.[p.id];
    const thisYear = new Date().getFullYear();
    if (!b)
      return (
        <button
          type="button"
          onClick={() => setBefore(p, { amount: p.amount.kind === "choice" ? "meat-heavy" : p.amount.default, until: thisYear - 1 })}
          className="inline-flex min-h-10 items-center text-sm underline underline-offset-4"
        >
          {p.section === "food" ? "Used to eat differently?" : p.id === "car" ? "Used to drive more or less?" : "Used to fly more or less?"}
        </button>
      );
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Until</span>
        <span className="w-24">
          <NumberInput label="The year it changed" step={1} value={b.until} onChange={(n) => setBefore(p, { ...b, until: Math.min(thisYear, Math.max(everydaySince(ctx), Math.round(n ?? thisYear))) })} />
        </span>
        <span>{p.section === "food" ? "I ate" : p.id === "car" ? "I drove" : "I flew"}</span>
        {p.amount.kind === "number" ? (
          <NumberInput
            label={`Before then: ${p.amount.label.toLowerCase()}`}
            step={p.amount.step}
            suffix={p.amount.unit}
            value={typeof b.amount === "number" ? b.amount : undefined}
            onChange={(n) => setBefore(p, { ...b, amount: n ?? 0 })}
          />
        ) : (
          <span className="w-56">
            <Select label="Before then: your diet" value={String(b.amount)} onChange={(v) => setBefore(p, { ...b, amount: v })} options={p.amount.options} />
          </span>
        )}
        <button type="button" onClick={() => setBefore(p, undefined)} className="min-h-10 px-2 underline">
          Same as now
        </button>
      </div>
    );
  };

  /**
   * Pay once for life, beside monthly and yearly (Ian, 2026-10-12): every item switches to
   * lifetime, past the usual cap and everyday items too, at today's habits to age 85.
   */
  const allLife = lines.length > 0 && lines.every((l) => l.cover.ahead === "lifetime");
  const setAllAhead = (ahead: Cover["ahead"]) => {
    setPicked((x) => ({ ...x, ...Object.fromEntries(lines.map((l) => [l.productId, { ...x[l.productId], ahead }])) }));
    // Lifetime prices show on every tile while paying once for life; going back hides them again, so
    // "or $X for life" stays on online items only (Ian, 2026-10-12).
    setAnyway((x) => ({ ...x, ...Object.fromEntries(lines.map((l) => [l.productId, ahead === "lifetime"])) }));
  };
  /** Monthly, yearly or once for life, for the whole plan. Picking monthly or yearly brings lifetime items back to ongoing. */
  const payChoices = (annualNote: string) =>
    lines.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2 text-sm" role="radiogroup" aria-label="How to pay">
        {(["monthly", "annual"] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={!allLife && billing === b}
            onClick={() => {
              setBilling(b);
              if (allLife) setAllAhead("monthly");
            }}
            className={`min-h-10 cursor-pointer rounded-md border px-3 ${
              !allLife && billing === b ? "border-rule bg-foreground text-background" : "border-rule hover:bg-card"
            }`}
          >
            Give {BILLING[b].label.toLowerCase()}
            {b === "annual" && annualNote}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={allLife}
          onClick={() => setAllAhead("lifetime")}
          className={`min-h-10 cursor-pointer rounded-md border px-3 ${allLife ? "border-rule bg-foreground text-background" : "border-rule hover:bg-card"}`}
        >
          Pay once for life
        </button>
        {allLife && lines.some((l) => !productById(l.productId)?.oneTime) && (
          <span className="basis-full text-xs text-muted">Home, travel, food and shopping are priced at today&apos;s habits until age {LIFETIME_TO_AGE}.</span>
        )}
      </div>
    );

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
          {BEFORE_GROUPS[p.id] && coverOf(p).past && beforeLine(p)}
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
  // The hero covers all AI use, not just chat (Ian, 2026-10-13): chat plus any images, video and coding, on one cover.
  const aiParts = PRODUCTS.filter((p) => p.section === "ai" && (p.id === ai.id || Number(amountOf(p)) > 0));
  // It leads with lifetime only while the whole AI total for life stays small; heavier use leads monthly.
  const heroLifetime = aiParts.reduce((t, p) => t + coverPrice(p, amountOf(p), { past: true, ahead: "lifetime" }, ctx).once, 0);
  const heroAhead = heroLifetime <= AI_LIFETIME_FIRST_MAX_USD ? "lifetime" : "monthly";
  const heroPast = picked.ai?.past ?? pastAll;
  // Each part takes the hero's cover where it's offered: a part too big for lifetime stays monthly, one under a cent a month is paid once.
  // When heavy use puts the hero on monthly, the smallest parts are still paid once for life, as long as everything paid
  // once stays within the lifetime limit, so chat doesn't trail 3¢ a month behind coding (Ian, 2026-10-13).
  const partLife = (p: Product) => coverPrice(p, amountOf(p), { past: true, ahead: "lifetime" }, ctx).once;
  const lifeParts = new Set<string>();
  if (heroAhead === "monthly")
    [...aiParts]
      .sort((a, b) => partLife(a) - partLife(b))
      .reduce((sum, p) => (sum + partLife(p) <= AI_LIFETIME_FIRST_MAX_USD ? (lifeParts.add(p.id), sum + partLife(p)) : AI_LIFETIME_FIRST_MAX_USD + 1), 0);
  const partAhead = (p: Product) => (lifeParts.has(p.id) ? "lifetime" : heroAhead);
  const heroLines = aiParts.map((p) => ({
    p,
    amount: amountOf(p),
    cover: effectiveCover(p, amountOf(p), ctx, { ahead: partAhead(p), past: heroPast }, anyway[p.id]),
  }));
  const heroName = (id: string, name: string) => ({ ai: "chat", "ai-media": "images", "ai-video": "video", "ai-coding": "coding" })[id] ?? name;
  // Parts already paid for drop out of the price; when every part is paid, the box shows what's offset (Ian, 2026-10-13).
  const paidLines = heroLines.filter((l) => paidCover(covered[l.p.id]));
  const dueLines = heroLines.filter((l) => !paidCover(covered[l.p.id]));
  const heroPaid = paidLines.length > 0 && !dueLines.length;
  const paidLife = paidLines.every((l) => paidCover(covered[l.p.id])?.kind === "life");
  const paidUntil = paidLines
    .map((l) => paidCover(covered[l.p.id]))
    .flatMap((c) => (c?.kind === "period" ? [c.until] : []))
    .sort()[0];
  const paidGift = paidLines.map((l) => covered[l.p.id]?.giftFrom).find(Boolean);
  const aiPrice = dueLines.reduce(
    (t, l) => {
      const c = coverPrice(l.p, l.amount, l.cover, ctx);
      return { once: t.once + c.once, monthly: t.monthly + c.monthly };
    },
    { once: 0, monthly: 0 },
  );
  // What the box shows: "for life" only when nothing is left to pay each month.
  const aiCover: Cover = { past: heroPast, ahead: aiPrice.monthly > 0 ? "monthly" : "lifetime" };
  // Paid for life shows everything it covers; paid for a stretch shows each month of it.
  const paidImpacts = (l: (typeof heroLines)[number]) => {
    const life = paidCover(covered[l.p.id])?.kind === "life";
    const c = coverImpacts(l.p, l.amount, life ? { past: true, ahead: "lifetime" } : { past: false, ahead: "monthly" }, ctx);
    return life ? c.once : c.monthly;
  };
  const aiImpacts = heroPaid
    ? sumImpacts(paidLines.map(paidImpacts))
    : sumImpacts(dueLines.flatMap((l) => Object.values(coverImpacts(l.p, l.amount, l.cover, ctx))));
  const paidNames = paidLines.map((l) => (l.p.id === "ai" ? "Chat" : heroName(l.p.id, l.p.name)));
  const heroIds = heroLines.map((l) => l.p.id);
  // Past use on monthly parts is spread over years, as checkout does, so the box never asks for a big one-time sum (Ian, 2026-10-13).
  const heroPlan = dueLines.map((l) => ({ productId: l.p.id, amount: l.amount, cover: l.cover }));
  const heroSpread = planTotals(heroPlan, ctx, billing, pastPick(Infinity) ?? bestPastYears(heroPlan, ctx, billing)).pastSpread;
  const heroPastOnce = dueLines.reduce((t, l) => t + (l.cover.past ? l.p.cost(l.amount, "past", ctx) : 0), 0) - (heroSpread?.total ?? 0);
  const heroLifeNames = dueLines
    .filter((l) => l.cover.ahead === "lifetime")
    .map((l) => heroName(l.p.id, l.p.name))
    .join(" and ");
  const heroNames = heroLines.map((l) => (l.p.id === "ai" ? "Chat" : heroName(l.p.id, l.p.name)));
  const heroParts = heroNames.length > 1 ? `${heroNames.slice(0, -1).join(", ")} and ${heroNames.at(-1)}` : "Chat";
  const heroInPlan = heroIds.every((id) => plan.includes(id) || paidCover(covered[id]));
  /** The hero's green button: puts every AI part in the plan on the hero's cover, then opens checkout. */
  const reviewAndPay = () => {
    setPlan((cur) => [...cur, ...heroIds.filter((id) => !cur.includes(id) && !paidCover(covered[id]))]);
    setPicked((x) => ({ ...x, ...Object.fromEntries(heroLines.map((l) => [l.p.id, { ...x[l.p.id], ...l.cover }])) }));
    setOpen(true);
    setCheckout(true);
    setTimeout(() => document.getElementById("pay-steps")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  return (
    <div className="pb-20">
      <section className="relative isolate pb-12">
        {heroPaid && !updatingNumbers ? (
          // Once all AI is paid, the photo carries what's offset instead of a price (Ian, 2026-10-13).
          <div className="relative py-10 lg:py-14">
            <div aria-hidden="true" className="hero-band" />
            <div className="border-t-[6px] border-rule bg-background px-5 pt-5 pb-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:px-8">
              {/* What the money does, in the same amounts the box showed before paying (Ian, 2026-10-13). */}
              <p className="mb-2 text-sm font-semibold text-life-ink">
                ✓ {paidLife ? "Your AI use, offset for life" : `Your AI use, offset through ${shortDate(paidUntil ?? "")}`}
                {paidGift && `, a gift from ${paidGift}`}
              </p>
              <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border pb-5 lg:grid-cols-4">
                {(
                  [
                    ["carbon", "kept out of the air", ""],
                    ["air", "met with clean-air work", ""],
                    ["water", "of water put back in dry rivers", " water"],
                    ["land", "of forest protected", " land"],
                  ] as const
                ).map(([k, what, unit]) => (
                  <div key={k}>
                    <dt className="sr-only">{IMPACT_INFO[k].label}</dt>
                    <dd className="amount text-2xl font-semibold">{IMPACT_INFO[k].format(aiImpacts[k], aiImpacts).replace(unit, "")}</dd>
                    <dd className="text-sm text-muted">{what}</dd>
                  </div>
                ))}
              </dl>
              <OffsetTimeline covered={Object.fromEntries(Object.entries(covered).filter(([, c]) => paidCover(c)))} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setUpdatingNumbers(true)}
                  className="min-h-10 cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-foreground"
                >
                  Using more AI now? Update your numbers
                </button>
                {!previewing && (
                  <Link
                    href="/record"
                    className="inline-flex min-h-11 items-center rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
                  >
                    Your record
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
        <div className="relative grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:py-12">
        {/* A photo behind the headline (Ian, 2026-10-13); a drawn landscape until a charity photo is in. */}
        <div aria-hidden="true" className="hero-band" />
        <div className="self-center">
          <h1 className={`font-display text-4xl leading-[1.08] font-semibold text-white ${paidLines.length && !heroPaid ? "sm:text-5xl" : "sm:text-[3.5rem]"}`}>
            {heroPaid
              ? paidLife
                ? "Your AI use is offset for life."
                : (
                    <>
                      <span className="block">Your AI use is offset</span>
                      <span className="block">through {shortDate(paidUntil ?? "")}.</span>
                    </>
                  )
              : (
                  // Two lines on a computer: what it is, then the price (Ian, 2026-10-13).
                  <>
                    <span className="block">{paidLines.length ? "Your other AI use" : "Your AI use"}, offset</span>
                    <span className="block">
                      {heroAhead === "lifetime" && aiCover.ahead === "lifetime" ? `for life: ${once(aiPrice.once)}.` : `for ${per(aiPrice.monthly, billing)}.`}
                    </span>
                  </>
                )}
          </h1>
        </div>

        <aside id="ai-chat" aria-label="AI chat, itemized" className="self-start border-t-[6px] border-rule bg-background px-6 pt-4 pb-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {heroPaid && (
            <p className={`pb-1 text-sm font-semibold ${paidLife ? "text-life-ink" : "text-period-ink"}`}>
              ✓ {paidLife ? "What you've offset, for life" : "What you're offsetting each month"}
              {paidGift && `, a gift from ${paidGift}`}
            </p>
          )}
          <dl className={`amount divide-y divide-border text-sm ${heroPaid ? "" : "-mt-2"}`}>
            {[
              ...(["carbon", "air", "water", "land"] as const).map((k) => [IMPACT_INFO[k].label, IMPACT_INFO[k].format(aiImpacts[k], aiImpacts)]),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-1 text-xs text-muted">
            <summary className="cursor-pointer underline underline-offset-2 hover:text-foreground">What&apos;s counted</summary>
            <p className="mt-1">
              {heroParts}, plus a share of training the models and building the data centers. Future use counts {LIFETIME_GROWTH_BUFFER} times over in case it
              grows, on a grid that gets cleaner each year. Past use is {pastNote(ai)}.{" "}
              <Link href="/method" className="cursor-pointer underline underline-offset-2 hover:text-foreground">
                Every number&apos;s source
              </Link>
            </p>
          </details>
          {heroPaid ? (
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">
              <span className="text-sm">
                {paidNames.length > 1 ? `${paidNames.slice(0, -1).join(", ")} and ${paidNames.at(-1)!.toLowerCase()}` : paidNames[0]}, paid.
                {paidLife ? " Nothing more to do." : ` Renews or ends ${shortDate(paidUntil ?? "")}.`}
              </span>
              {!previewing && (
                <Link
                  href="/record"
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
                >
                  Your record
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">
              {aiPrice.monthly > 0 && (aiPrice.once > 0 || heroSpread) ? (
                // Two charges: the monthly leads, and the one-time part says what it pays for (Ian, 2026-10-13).
                <span>
                  <span className="amount block text-2xl font-semibold">{per(aiPrice.monthly, billing)}</span>
                  <span className="block text-sm text-muted">
                    {[
                      heroSpread &&
                        `+ ${per(heroSpread.perMonth, billing)} for ${heroSpread.years === 1 ? "a year" : `${heroSpread.years} years`} for past use`,
                      heroPastOnce >= 0.005 && `+ ${once(heroPastOnce)} once for past use`,
                      aiPrice.once - heroPastOnce >= 0.005 && `+ ${once(aiPrice.once - heroPastOnce)} once to offset ${heroLifeNames} for life`,
                    ]
                      .filter(Boolean)
                      .map((t) => (
                        <span key={String(t)} className="block">
                          {t}
                        </span>
                      ))}
                  </span>
                </span>
              ) : (
                <span className="amount text-2xl font-semibold">{priceText(aiPrice, aiCover, billing)}</span>
              )}
              <button
                type="button"
                onClick={reviewAndPay}
                className="min-h-11 shrink-0 cursor-pointer rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
              >
                {heroInPlan ? "Review and give" : "Offset my AI use"}
              </button>
            </div>
          )}
          {!heroPaid && paidNames.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {paidNames.join(" and ")} {paidNames.length > 1 ? "are" : "is"} already offset.
            </p>
          )}
          {heroIds.some((id) => plan.includes(id) && !paidCover(covered[id])) && (
            <button
              type="button"
              onClick={() => setPlan((cur) => cur.filter((id) => !heroIds.includes(id) || paidCover(covered[id])))}
              className="mt-2 min-h-10 cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-foreground"
            >
              Take AI out of your plan
            </button>
          )}
        </aside>
        </div>
        )}
        {heroPaid && !updatingNumbers ? null : (
          <div className="mt-10">
            <AiQuickPick
              keepGuess={Boolean(ctx.aiEstimate?.level)}
              level={
                ctx.aiFromExport || entered.ai
                  ? null
                  : (ctx.aiEstimate?.level ?? (aiAmount === AI_LEVELS.medium.promptsPerDay ? "medium" : null))
              }
              onPick={(level, from) => {
                setCtx((c) => ({ ...c, aiEstimate: { level, from }, aiFromExport: false, aiWhPerPrompt: undefined, aiPastWh: undefined, aiCode: undefined, aiAgent: undefined, aiCodingPastWh: undefined }));
                // Images and video follow the pick too, unless the person typed their own. A pick replaces connected data
                // entirely, so measured coding goes back to none (Ian, 2026-10-13).
                setAmounts((a) => ({
                  ...a,
                  ai: AI_LEVELS[level].promptsPerDay,
                  ...(entered["ai-media"] ? {} : { "ai-media": AI_LEVELS[level].imagesPerWeek }),
                  ...(entered["ai-video"] ? {} : { "ai-video": AI_LEVELS[level].videosPerWeek }),
                  ...(entered["ai-coding"] ? {} : { "ai-coding": 0 }),
                }));
                resetAiCover();
                setEntered((e) => ({ ...e, ai: false }));
              }}
              onExact={() => setMeasuring(true)}
              onVideo={(h, from) => measuredAmount("video", h, from)}
              onVideoPast={(videoPast) => setCtx((c) => ({ ...c, videoPast }))}
              onRides={(n) => measuredAmount("rideshare", n, ["uber"])}
              onDelivery={(n) => measuredAmount("delivery", n, ["doordash", "ubereats"])}
              onShopping={amazonShopping}
              onMeasured={(s, note) => {
                const d = digitalFromExport(s);
                setCtx((c) => ({
                  ...c,
                  aiWhPerPrompt: d.aiWhPerPrompt,
                  aiCode: d.aiCode,
                  aiAgent: d.aiAgent,
                  aiFromExport: !note,
                  aiPastWh: note ? undefined : d.aiPastWh,
                  aiCodingPastWh: note ? undefined : d.aiCodingPastWh,
                  aiEstimate: note ? { from: note } : undefined,
                }));
                setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek, ...(d.aiCodingPastWh !== undefined ? { "ai-coding": d.aiCodingHoursPerWeek } : {}) }));
                resetAiCover();
                setEntered((e) => ({ ...e, ai: false, "ai-media": false, ...(d.aiCodingPastWh !== undefined ? { "ai-coding": false } : {}) }));
              }}
            />
            <div className="mt-3 text-sm">
              {editing === ai.id ? (
                amountLine(ai)
              ) : (
                <button type="button" onClick={() => setEditing(ai.id)} className="min-h-10 cursor-pointer text-muted underline underline-offset-4 hover:text-foreground">
                  {entered.ai ? `Using your number, ${aiAmount} prompts a day. Change it` : "Or type in your own number"}
                </button>
              )}
            </div>
          </div>
          )}
          {measuring && (
            <div className="mt-6 max-w-xl">
              <AiExportUpload
                onResult={(s) => {
                  const d = digitalFromExport(s);
                  setCtx((c) => ({ ...c, aiWhPerPrompt: d.aiWhPerPrompt, aiCode: d.aiCode, aiAgent: d.aiAgent, aiFromExport: true, aiPastWh: d.aiPastWh, aiCodingPastWh: d.aiCodingPastWh, aiEstimate: undefined }));
                  setAmounts((a) => ({ ...a, ai: d.aiPromptsPerDay, "ai-media": d.aiMediaPerWeek, ...(d.aiCodingPastWh !== undefined ? { "ai-coding": d.aiCodingHoursPerWeek } : {}) }));
                  resetAiCover();
                  setEntered((e) => ({ ...e, ai: false, "ai-media": false, ...(d.aiCodingPastWh !== undefined ? { "ai-coding": false } : {}) }));
                }}
              />
            </div>
          )}
      </section>

      {activityOpen && (
        <section id="link-activity" aria-label="Add your history" className="mb-6 max-w-2xl border-y border-border py-3 text-sm">
          <ActivityUpload
            onResult={(found, from) => {
              setAmounts((a) => ({ ...a, ...found }));
              if ("ai" in found) resetAiCover();
              setEntered((e) => ({ ...e, ...Object.fromEntries(Object.keys(found).map((k) => [k, false])) }));
              setLinkedFrom((l) => ({ ...l, ...from }));
            }}
          />
        </section>
      )}

      <nav aria-label="Other things you can do" className="mb-10 flex flex-col text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
        {recordStatus(covered).kind !== "none" && !previewing && (
          <>
            <Link href="/record" className="inline-flex min-h-10 items-center font-semibold underline underline-offset-4 hover:text-muted">
              Your record
            </Link>
            <span aria-hidden className="hidden text-muted sm:inline">·</span>
          </>
        )}
        <span className="hidden text-muted sm:inline">Not sure yet?</span>
        <Link href="/ledger" className="inline-flex min-h-10 items-center underline underline-offset-4 hover:text-muted">
          Where the money goes
        </Link>
        <Link href="/method" className="inline-flex min-h-10 items-center underline underline-offset-4 hover:text-muted">
          How we calculate
        </Link>
        <span aria-hidden className="hidden text-muted sm:inline">·</span>
        <span className="hidden text-muted sm:inline">Giving?</span>
        <Link href="/gift" className="inline-flex min-h-10 items-center underline underline-offset-4 hover:text-muted">
          Cover a friend&apos;s AI use
        </Link>
      </nav>

      {(() => {
        const open = shelvesOpen || plan.some((id) => id !== "ai") || Object.keys(covered).some((id) => id !== "ai") || Object.keys(linkedFrom).length > 0;
        const openAt = (key: string) => {
          setShelvesOpen(true);
          requestAnimationFrame(() => document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
        };
        return open ? null : (
          <section aria-labelledby="more-heading" className="mb-10">
            <h2 id="more-heading" className="font-display text-3xl font-extrabold [font-stretch:85%]">Cover more than AI</h2>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {SECTIONS.filter((x) => x.key !== "ai").map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    onClick={() => openAt(x.key)}
                    className="min-h-11 w-full cursor-pointer rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
                  >
                    {x.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {(shelvesOpen || plan.some((id) => id !== "ai") || Object.keys(covered).some((id) => id !== "ai") || Object.keys(linkedFrom).length > 0) && (
      <>
      <div className="mb-4">
        <h2 className="font-display text-3xl font-extrabold [font-stretch:85%]">Cover more than AI</h2>
      </div>

      {/* The aisle bar sticks only while the shelves are on screen. */}
      <div>
      <nav aria-label="Aisles" className="sticky top-0 z-20 -mx-4 mb-8 border-b-2 border-rule bg-background px-4">
        {/* Equal widths across the page; a phone scrolls them sideways (Ian, 2026-10-13). */}
        <ul className="flex gap-2 overflow-x-auto py-2 text-sm font-semibold [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <li key={s.key} className="min-w-24 flex-1 basis-0">
              <a
                href={`#section-${s.key}`}
                className="flex min-h-10 items-center justify-center rounded-md border border-border px-3 whitespace-nowrap hover:border-rule hover:bg-card"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((s) => {
        const common = COMMON_FIRST[s.key] ?? [];
        const rank = (p: Product, i: number) => (linkedFrom[p.id] ? 0 : 1000) + (common.includes(p.id) ? common.indexOf(p.id) : 100 + i);
        const items = PRODUCTS.filter((p) => p.section === s.key)
          .map((p, i) => ({ p, r: rank(p, i) }))
          .sort((a, b) => a.r - b.r)
          .map(({ p }) => p);
        if (!items.length) return null;
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
              <div className="flex shrink-0 items-baseline gap-4">
                {addable(items).length > 1 &&
                  (addable(items).every((p) => plan.includes(p.id)) ? (
                    <span className="text-sm text-muted">All in your plan</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addGroup(items)}
                      className="min-h-10 cursor-pointer text-sm font-semibold underline underline-offset-4"
                    >
                      Add all {addable(items).length} <span className="amount font-normal text-muted">· {groupPrice(items)}</span>
                    </button>
                  ))}
              </div>
            </div>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
              {items.map((p) => tile(p))}
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

      {addable(PRODUCTS).length > 0 && (
        <section aria-labelledby="everything-heading" className="mb-10 border-t-2 border-rule pt-4">
          <h2 id="everything-heading" className="text-xl font-bold">
            Cover everything
          </h2>
          <p className="mt-1 text-sm text-muted">
            Every item above at the amounts shown:{" "}
            {Math.abs(everything.today - everything.then) > 0.01 && (
              <>
                <span className="amount font-semibold text-foreground">{usd(everything.today)}</span> today, then{" "}
              </>
            )}
            <span className="amount font-semibold text-foreground">
              {usd(everything.then)} {BILLING[billing].per}
            </span>
            , card fees included
            {everything.spread && (
              <>
                , with <span className="amount font-semibold text-foreground">{usd(everything.spread.perMonth * (billing === "annual" ? 12 : 1))}</span> of
                it toward past use for {everything.spread.years} years
              </>
            )}
            . Covering it all earns the Fully Offset badge.
          </p>
          {addable(PRODUCTS).every((p) => plan.includes(p.id)) ? (
            <p className="mt-3 text-sm font-semibold">Everything is in your plan.</p>
          ) : (
            <button
              type="button"
              onClick={addEverything}
              className="mt-3 min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85"
            >
              Add everything
            </button>
          )}
          <p className="mt-3 text-sm">
            <Link href="/gift" className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
              Give an offset to someone else
            </Link>
          </p>
        </section>
      )}
      </>
      )}

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
                        <label className="ml-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-muted">
                          <input
                            type="checkbox"
                            checked={l.cover.past}
                            onChange={(e) => setPast(l.productId, e.target.checked)}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          past use
                        </label>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="figures">
                          {totals.pastSpread && l.pastCost > 0 && l.cover.ahead === "monthly"
                            ? [
                                per(l.aheadCost, billing),
                                `${per(l.pastCost / (totals.pastSpread.years * 12), billing)} for ${totals.pastSpread.years} yr${totals.pastSpread.years > 1 ? "s" : ""}`,
                              ].join(" + ")
                            : priceText({ once: l.pastCost + (l.cover.ahead === "lifetime" ? l.aheadCost : 0), monthly: l.aheadCost }, l.cover, billing)}
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
                {pastTotal > 0 && (
                  <div className="mt-2 border-t border-border pt-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="When to pay for past use">
                      <span className="text-muted">
                        Pay past use (<span className="figures">{once(pastTotal)}</span>)
                      </span>
                      {PAST_YEARS.filter((y) => y > 0 || allNowOk(pastTotal)).map((y) => (
                        <button
                          key={y}
                          type="button"
                          role="radio"
                          aria-checked={spreadYears === y}
                          onClick={() => setPastYears(y)}
                          className={`min-h-10 cursor-pointer rounded-md border px-3 ${
                            spreadYears === y ? "border-rule bg-foreground text-background" : "border-rule hover:bg-card"
                          }`}
                        >
                          {y === 0 ? "All now" : `Over ${y} year${y > 1 ? "s" : ""}`}
                        </button>
                      ))}
                    </div>
                    {totals.pastSpread && (
                      <p className="mt-1 text-xs text-muted">
                        <span className="figures">
                          {usd(totals.pastSpread.perMonth * (billing === "annual" ? 12 : 1))} {BILLING[billing].per}
                        </span>{" "}
                        for {totals.pastSpread.years} year{totals.pastSpread.years > 1 ? "s" : ""}, added to your {billing === "annual" ? "yearly" : "monthly"}{" "}
                        gifts. Nothing is added or taken off. Lifetime items&apos; past use is paid with them, all at once.
                      </p>
                    )}
                  </div>
                )}
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
                      <span className="text-muted"> on online, device and AI items</span>
                    </span>
                  </label>
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pastEveryday}
                      onChange={(e) => setPastEveryday(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="font-medium">Include past use</span>
                      <span className="text-muted"> on everyday items too</span>
                    </span>
                  </label>
                  <label className="block">
                    <span className="block text-muted">Everyday past use since</span>
                    <span className="mt-1 block w-24">
                      <NumberInput
                        label="Everyday past use since"
                        min={ctx.birthYear}
                        value={everydaySince(ctx)}
                        onChange={(n) => setCtx((c) => ({ ...c, pastSinceYear: n === undefined || n === c.birthYear + PAST_FROM_AGE ? undefined : n }))}
                      />
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
                {every ? (
                  <>
                    <dl className="figures mt-3 space-y-1 border-t border-border pt-3 text-sm">
                      {giftRows.map((r) => (
                        <div key={r.key} className="flex justify-between gap-4">
                          <dt className="font-sans text-muted">
                            {charityName(r)} ({harmsText(r.harms, (k) => IMPACT_INFO[k].label.toLowerCase())}
                            {r.frequency !== "ONCE" && `, ${BILLING[billing].per}`})
                          </dt>
                          <dd className="shrink-0 text-right">
                            {usd(r.donation)} + {usd(r.fee)} fee
                          </dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
                        <dt className="font-sans">Total today</dt>
                        <dd>{usd(dueToday)}</dd>
                      </div>
                      {repeatTotal > 0 && (
                        <p className="font-sans text-muted">
                          Then {usd(repeatTotal)} {BILLING[billing].per}, one gift to each charity with its own card fee.{" "}
                          {autopay ? "Every.org charges it until you stop it." : "Nothing repeats on its own: you come back and give again."}
                          {totals.pastSpread &&
                            ` It includes ${usd(totals.pastSpread.perMonth * (billing === "annual" ? 12 : 1))} toward past use until ${pastEnds}${
                              autopay ? "; Every.org can't stop that part on its own, so lower the gift in your Every.org account then." : "."
                            }`}
                        </p>
                      )}
                    </dl>
                    {payChoices(" (one 30¢ fee per charity a year)")}
                    <p className="mt-2 text-xs text-muted">
                      Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank payments
                      nothing. Each gift includes its card fee so the whole donation arrives; pay by bank and the charity keeps the fee
                      too. Every.org may also ask for a tip for itself, which is optional. The smallest gift is {usd(MIN_DONATION_USD)}; a
                      charity&apos;s share under that is rounded up, so each part&apos;s money stays with its own charity. Every.org emails you a
                      receipt for each gift.
                    </p>
                    {!paymentsOn() && (
                      <p className="mt-3 text-sm font-semibold">Payments open soon. Your plan stays saved in this browser until then.</p>
                    )}
                    {paymentsOn() && checkout && (
                      <PaySection
                        rows={giftRows}
                        lines={totals.lines.map((l) => ({ productId: l.productId, lifetime: l.cover.ahead === "lifetime", past: l.cover.past }))}
                        listing={{ lines, ctx, pastYears: spreadYears }}
                        billing={billing}
                        hasRepeat={repeatTotal > 0}
                        autopay={autopay}
                        setAutopay={setAutopay}
                        payState={payState}
                        setPayState={setPayState}
                      />
                    )}
                  </>
                ) : fund ? (
                  <>
                    <dl className="figures mt-3 space-y-1 border-t border-border pt-3 text-sm">
                      {fund.today.parts.map((p) => (
                        <div key={p.charity} className="flex justify-between gap-4">
                          <dt className="font-sans text-muted">
                            {CHARITIES[p.charity].name} ({harmsText(p.harms, (k) => IMPACT_INFO[k].label.toLowerCase())})
                          </dt>
                          <dd className="shrink-0 text-right">{usd(p.amount)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-4">
                        <dt className="font-sans text-muted">
                          Endaoment fees ({ENDAOMENT_IN_LABEL} in, {ENDAOMENT_GRANT_LABEL} to grant it out)
                        </dt>
                        <dd className="shrink-0 text-right">{usd(fund.today.endaoment)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-sans text-muted">Card fee (estimated)</dt>
                        <dd className="shrink-0 text-right">{usd(fund.today.card)}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
                        <dt className="font-sans">Total today, one gift</dt>
                        <dd>{usd(dueToday)}</dd>
                      </div>
                      {fund.repeat && (
                        <p className="font-sans text-muted">
                          Then {usd(fund.repeat.total)} {BILLING[billing].per} as one gift, fees included. Nothing repeats on its own: you
                          come back and give again.
                          {totals.pastSpread &&
                            ` It includes ${usd(totals.pastSpread.perMonth * (billing === "annual" ? 12 : 1))} toward past use until ${pastEnds}.`}
                        </p>
                      )}
                    </dl>
                    {payChoices(" (one card fee a year)")}
                    <p className="mt-2 text-xs text-muted">
                      You give once, to My Offset&apos;s fund at Endaoment, a nonprofit that runs charitable funds. Endaoment grants each
                      charity its part above, keeping {ENDAOMENT_IN_LABEL} as the gift comes in and {ENDAOMENT_GRANT_LABEL} as it goes
                      out. Both fees and the card fee are added on top, so the whole donation arrives. The card fee is our estimate (
                      {ENDAOMENT_CARD_LABEL}) until Endaoment confirms it. There&apos;s no smallest gift, so each part goes to its own
                      charity to the cent. Endaoment emails you the tax receipt.
                    </p>
                    {!paymentsOn() && (
                      <p className="mt-3 text-sm font-semibold">Payments open soon. Your plan stays saved in this browser until then.</p>
                    )}
                    {paymentsOn() && checkout && (
                      <FundPaySection
                        gift={fund.today}
                        lines={totals.lines.map((l) => ({ productId: l.productId, lifetime: l.cover.ahead === "lifetime", past: l.cover.past }))}
                        billing={billing}
                        payState={payState}
                        setPayState={setPayState}
                      />
                    )}
                  </>
                ) : (
                  <>
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
                      <dt className="font-sans text-muted">Card fee ({CARD_FEE_LABEL})</dt>
                      <dd>{usd(feeParts(totals.oneTime?.donation ?? 0).card + feeParts(totals.recurring?.donation ?? 0).card)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-sans text-muted">
                        <Link href="/ledger#sponsor" className="underline underline-offset-2 hover:text-foreground">
                          Charity sponsor fee
                        </Link>{" "}
                        ({SPONSOR_FEE_LABEL})
                      </dt>
                      <dd>{usd(feeParts(totals.oneTime?.donation ?? 0).sponsor + feeParts(totals.recurring?.donation ?? 0).sponsor)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
                      <dt className="font-sans">Total today</dt>
                      <dd>{usd(dueToday)}</dd>
                    </div>
                    {totals.recurring && (
                      <p className="font-sans text-muted">
                        Then {usd(totals.recurring.total)} {BILLING[billing].per} ({usd(totals.recurring.donation)} donation +{" "}
                        {usd(totals.recurring.fee)} fees). Cancel anytime.
                        {totals.pastSpread && ` Includes past use until ${pastEnds}.`}
                      </p>
                    )}
                  </dl>
                  {payChoices(" (one 30¢ charge a year)")}
                  <p className="mt-2 text-xs text-muted">
                    The smallest donation is {usd(MIN_DONATION_USD)}. We pool small donations and send each charity one payment a
                    month, so none is lost to extra card fees. You approve each payment yourself, unless you choose autopay, and even then we email you before every charge.
                  </p>
                  </>
                )}
                <GiveDirectly totals={totals} ctx={ctx} billing={billing} />
                <ShareAi
                  totals={aiMonthTotals(
                    {
                      prompts: Number(amountOf(ai)) || 0,
                      images: Number(amountOf(productById("ai-media")!)) || 0,
                      videos: Number(amountOf(productById("ai-video")!)) || 0,
                      codingHours: Number(amountOf(productById("ai-coding")!)) || 0,
                    },
                    ctx,
                  )}
                />
                {PAYMENT_MODE === "sponsor" && checkout && (
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
                    thenTotal > 0 && `then ${usd(thenTotal)}${billing === "annual" ? "/yr" : "/mo"}`,
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
                  requestAnimationFrame(() => document.getElementById("pay-steps")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                className="min-h-11 shrink-0 cursor-pointer rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
              >
                Review and give
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shares a month of AI use as a link with a receipt card. Only the two totals go in the link. */
function ShareAi({ totals }: { totals: ShareTotals }) {
  const [status, setStatus] = useState<string | null>(null);
  const share = async () => {
    const url = `${window.location.origin}/share?${shareQuery(totals)}`;
    const lines = shareLines(totals);
    const text = `My AI use this month: ${lines.carbon} and ${lines.life} of healthy life lost to air pollution.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My AI use this month", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch (e) {
      // Closing the share sheet isn't an error.
      if ((e as Error)?.name !== "AbortError") setStatus("Couldn't share. Try again.");
    }
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={share}
        className="min-h-10 rounded-md border-2 border-rule px-3 font-medium hover:bg-foreground hover:text-background"
      >
        Share my AI month
      </button>
      <span className="text-muted" role="status">
        {status ?? "Shares your AI totals only, not your prompts or plan."}
      </span>
    </div>
  );
}

const HARM_ORDER = ["carbon", "air", "water", "land", "ewaste"] as const;

/** For people who'd rather skip our fees and give to each charity on their own. */
function GiveDirectly({ totals, ctx, billing }: { totals: ReturnType<typeof planTotals>; ctx: Context; billing: Billing }) {
  const split = harmSplit(totals, ctx, billing);
  const rows = HARM_ORDER.filter((k) => split[k].once >= 0.01 || split[k].perPeriod >= 0.01);
  if (!rows.length) return null;
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted underline underline-offset-2 hover:text-foreground">
        Prefer to give to the charities yourself?
      </summary>
      <p className="mt-2 text-muted">
        {forMode({
          every: "You can give these amounts on each charity's own site instead.",
          endaoment: "You can skip Endaoment's fees by giving these amounts on each charity's own site.",
          sponsor: "You can skip our fees by giving these amounts on each charity's own site.",
        })}{" "}
        We can&apos;t see those gifts, so they won&apos;t
        count toward your Fully Offset badge or mark items as covered here, and some charities have a minimum gift.
      </p>
      <dl className="figures mt-2 space-y-1 border-t border-border pt-2">
        {rows.map((k) => {
          const c = CHARITIES[k];
          const parts = [
            split[k].once >= 0.01 && `${usd(split[k].once)} once`,
            split[k].perPeriod >= 0.01 && `${usd(split[k].perPeriod)} ${BILLING[billing].per}`,
          ].filter(Boolean);
          return (
            <div key={k} className="flex justify-between gap-4">
              <dt className="font-sans">
                <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  {c.name}
                </a>{" "}
                <span className="text-muted">({IMPACT_INFO[k].label.toLowerCase()})</span>
              </dt>
              <dd className="text-right">{parts.join(" + ")}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

/** Above this, the first Give waits for a one-tap confirmation of the day's total. */
const BIG_PAYMENT_USD = 100;

/** Picks with the monthly-or-lifetime choice forgotten for the items that match. */
function withoutAhead(picked: Record<string, Partial<Cover>>, forget: (id: string) => boolean) {
  return Object.fromEntries(Object.entries(picked).map(([id, c]) => [id, forget(id) ? { ...c, ahead: undefined } : c]));
}

/**
 * Paying each charity in turn through Every.org: an autopay choice, then one
 * row per charity with a Give button on the next one. The list is saved when
 * the first Give is tapped, so the person can stop and come back to it.
 */
function PaySection({
  rows,
  lines,
  billing,
  hasRepeat,
  autopay,
  setAutopay,
  payState,
  setPayState,
  listing,
}: {
  rows: PayRow[];
  lines: Checkout["lines"];
  /** What the server needs to work the checkout out again for the public list. */
  listing: { lines: PlanLine[]; ctx: Context; pastYears: PastYears };
  billing: Billing;
  hasRepeat: boolean;
  autopay: boolean;
  setAutopay: (v: boolean) => void;
  payState: Checkout | null;
  setPayState: (c: Checkout | null) => void;
}) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [confirmedBig, setConfirmedBig] = useState(false);
  const [listName, setListName] = useState<string | null>(null);
  const [listNote, setListNote] = useState("");
  // Every row is charged today, a repeating one for the first time.
  const today = sumTotal(rows);
  useEffect(() => setDraftId(newPlanId()), []);
  // A list already started keeps its own rows, even if the plan has changed since.
  const started = payState && Object.keys({ ...payState.done, ...payState.confirmed }).length > 0 ? payState : null;
  // A list saved by tapping Give but not come back from keeps its id, so a gift made then still counts.
  const saved = payState && JSON.stringify(payState.rows) === JSON.stringify(rows) ? payState : null;
  const current: Checkout | null =
    saved ??
    (draftId
      ? { id: draftId, created: new Date().toISOString(), billing, rows, lines, done: {}, confirmed: {}, plan: { lines: listing.lines, ctx: listing.ctx, pastYears: listing.pastYears } }
      : null);
  return (
    <section id="pay-steps" aria-labelledby="pay-heading" className="mt-4 scroll-mt-4 border-t-2 border-rule pt-3">
      <h3 id="pay-heading" className="text-base font-bold">
        Give to each charity
      </h3>
      {started ? (
        <>
          <CheckoutSteps checkout={started} onChange={setPayState} />
          {allConfirmed(started) && (
            <ListInvite
              what="this checkout"
              // Only while the plan still matches the checkout, since the server works the claim out again from it.
              join={
                saved
                  ? (name) =>
                      joinList(name, { source: "plan", planId: started.id, billing, autopay, pastYears: listing.pastYears, lines: listing.lines, ctx: listing.ctx, rows })
                  : undefined
              }
            />
          )}
          <SteadyCheck plan={steadyPlan(started)} inStore />
          <button
            type="button"
            onClick={() => {
              saveCheckout(null);
              setPayState(null);
              setDraftId(newPlanId());
            }}
            className="mt-2 min-h-10 cursor-pointer text-sm text-muted underline underline-offset-2 hover:text-foreground"
          >
            Start a new list from your plan as it is now
          </button>
        </>
      ) : (
        <>
          {hasRepeat && (
            <label className="mt-2 flex min-h-10 cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={autopay}
                onChange={(e) => setAutopay(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]"
              />
              <span>
                <span className="font-medium">Repeat these gifts automatically {BILLING[billing].approve}</span>
                <span className="block text-muted">
                  Off unless you tick it. With it on, Every.org charges your card {BILLING[billing].approve} until you cancel in your
                  Every.org account. We can&apos;t email you first or hold a charge back, so leave it off to approve each one yourself.
                </span>
              </span>
            </label>
          )}
          {current && rows.length > 0 && today > BIG_PAYMENT_USD && !confirmedBig && !saved ? (
            <div className="mt-3 border-y-2 border-rule py-3 text-sm">
              <p className="font-semibold">
                You&apos;re giving <span className="figures">{usd(today)}</span> today to {rows.length} charit
                {rows.length === 1 ? "y" : "ies"}.
              </p>
              <p className="mt-1 text-muted">A check before anything opens, since it&apos;s a big gift. Each charity&apos;s page shows its own part again.</p>
              <button
                type="button"
                onClick={() => setConfirmedBig(true)}
                className="mt-2 min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85"
              >
                Confirm
              </button>
            </div>
          ) : current && rows.length > 0 && (
            <CheckoutSteps
              checkout={current}
              saved={!!saved}
              onChange={setPayState}
              onGo={() => {
                const c = { ...current, created: new Date().toISOString() };
                saveCheckout(c);
                setPayState(c);
                if (listName && !saved)
                  joinList(listName, { source: "plan", planId: c.id, billing, autopay, pastYears: listing.pastYears, lines: listing.lines, ctx: listing.ctx, rows }).then(
                    (err) => setListNote(err ?? `You'll show on the public list as ${listName} once Every.org confirms every gift.`),
                  );
              }}
            />
          )}
          {!saved && current && rows.length > 0 && <ListOptIn label="List me publicly" onChange={setListName} />}
          {listNote && (
            <p role="status" className="mt-2 text-sm">
              {listNote} <Link href="/list/edit" className="underline">Change or leave</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Giving through the Endaoment fund: one gift and one Give button, which opens
 * the fund's page in a new tab. With no webhook or reference from Endaoment yet,
 * the gift is kept here as given and pending confirmation, and nothing is marked
 * offset from it.
 */
function FundPaySection({
  gift,
  lines,
  billing,
  payState,
  setPayState,
}: {
  gift: FundGift;
  lines: Checkout["lines"];
  billing: Billing;
  payState: Checkout | null;
  setPayState: (c: Checkout | null) => void;
}) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [confirmedBig, setConfirmedBig] = useState(false);
  useEffect(() => setDraftId(newPlanId()), []);
  const href = fundLink();
  const given = payState?.fund && payState.done.fund ? payState : null;
  if (!href) return null;
  return (
    <section id="pay-steps" aria-labelledby="pay-heading" className="mt-4 scroll-mt-4 border-t-2 border-rule pt-3">
      <h3 id="pay-heading" className="text-base font-bold">
        Give through Endaoment
      </h3>
      {given ? (
        <>
          <p className="mt-2 text-sm" role="status">
            <span className="font-semibold">
              <span aria-hidden>✓ </span>Given <span className="figures">{usd(given.fund!.total)}</span>, pending confirmation
            </span>
            <span className="block text-muted">
              Endaoment emails your tax receipt. Items are marked offset here once we can confirm gifts with Endaoment.
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              saveCheckout(null);
              setPayState(null);
              setDraftId(newPlanId());
            }}
            className="mt-2 min-h-10 cursor-pointer text-sm text-muted underline underline-offset-2 hover:text-foreground"
          >
            Start a new gift from your plan as it is now
          </button>
        </>
      ) : gift.total > BIG_PAYMENT_USD && !confirmedBig ? (
        <div className="mt-3 border-y-2 border-rule py-3 text-sm">
          <p className="font-semibold">
            You&apos;re giving <span className="figures">{usd(gift.total)}</span> today, in one gift.
          </p>
          <p className="mt-1 text-muted">A check before anything opens, since it&apos;s a big gift.</p>
          <button
            type="button"
            onClick={() => setConfirmedBig(true)}
            className="mt-2 min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85"
          >
            Confirm
          </button>
        </div>
      ) : (
        draftId && (
          <div className="mt-3 text-sm">
            <a
              href={href}
              target="_blank"
              rel="noopener"
              onClick={() => {
                const c: Checkout = { id: draftId, created: new Date().toISOString(), billing, rows: [], lines, done: { fund: new Date().toISOString() }, confirmed: {}, fund: gift };
                saveCheckout(c);
                setPayState(c);
              }}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
            >
              Give {usd(gift.total)}
            </a>
            <p className="mt-2 text-muted">
              Opens the My Offset fund on Endaoment in a new tab. Give <span className="figures">{usd(gift.total)}</span> there, and
              Endaoment grants each charity its part.
            </p>
            <p className="mt-2 text-muted">
              Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what we promise</Link> and{" "}
              <Link href="/method">how each price is worked out</Link>. None of it passes through My Offset.
            </p>
          </div>
        )
      )}
    </section>
  );
}
