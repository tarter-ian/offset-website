"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeList } from "./Badge";
import { CheckoutSteps, FundSteps } from "./Checkout";
import { joinList, ListInvite, ListOptIn, savedListing } from "./ListOptIn";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import { IMPACT_KEYS } from "@/lib/footprint";
import {
  andList,
  chargeTotal,
  defaultGiftSpan,
  GIFT_CONFIRM_OVER_USD,
  GIFT_LIMITS,
  GIFT_PRESETS,
  GIFT_SPANS,
  GIFTABLE,
  type Gift,
  giftCharge,
  giftCharities,
  giftContext,
  giftImpacts,
  type GiftItem,
  giftPath,
  giftSentence,
  type GiftSpan,
  giftSteps,
  giftUntil,
  presetItems,
  recipients,
  SPAN_LABEL,
  spanMonths,
} from "@/lib/gifts";
import { badgesFor } from "@/lib/badges";
import { IMPACT_INFO } from "@/lib/impacts";
import { allConfirmed, type Checkout, forMode, newPlanId, PAYMENT_MODE, paymentsOn, PLAN_ID } from "@/lib/payments";
import { usd } from "@/lib/pricing";
import { DEFAULT_CONTEXT, defaultAmount, type Product, productById, SECTIONS } from "@/lib/store";

// One gift in progress per browser, kept apart from the person's own checkout.
const GIFT_KEY = "offset:gift:v1";

function loadGift(): Checkout | null {
  try {
    const c = JSON.parse(localStorage.getItem(GIFT_KEY) ?? "null") as Checkout | null;
    return c && PLAN_ID.test(c.id) && Array.isArray(c.rows) ? { ...c, done: c.done ?? {}, confirmed: c.confirmed ?? {} } : null;
  } catch {
    return null;
  }
}

function saveGift(c: Checkout | null) {
  try {
    if (c) localStorage.setItem(GIFT_KEY, JSON.stringify(c));
    else localStorage.removeItem(GIFT_KEY);
  } catch {
    // Storage blocked: progress lasts only while the page is open.
  }
}

const inputClass = "mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3";

type Picks = Record<string, GiftSpan>;
const toItems = (picks: Picks): GiftItem[] => Object.entries(picks).map(([productId, span]) => ({ productId, span }));

/** The gift as its card reads, for both the giver's preview and the person receiving it, whose page it heads. */
function GiftCard({ gift, heading }: { gift: Pick<Gift, "items" | "from" | "to" | "note" | "birthYear"> & { createdAt?: string }; heading?: boolean }) {
  const Sentence = heading ? "h1" : "p";
  const charities = gift.items.length ? giftCharities(gift.items, gift.birthYear) : [];
  const from = gift.createdAt ?? new Date().toISOString();
  const seals = badgesFor(gift.items.map((i) => ({ productId: i.productId, until: giftUntil(i, from) })));
  return (
    <div className="border-y-4 border-rule py-5">
      <p className="text-sm text-muted">A gift for {gift.to || "someone"}</p>
      <Sentence className="mt-1 text-2xl font-extrabold [font-stretch:85%]">
        {gift.from || "Someone"} offset {giftSentence(gift.items) || "something for you"}.
      </Sentence>
      {gift.note && <p className="mt-3 whitespace-pre-line">&ldquo;{gift.note}&rdquo;</p>}
      {seals.length > 0 && (
        <div className="mt-4">
          <BadgeList badges={seals} seals label="Badges in this gift" />
        </div>
      )}
      {charities.length > 0 && (
        <p className="mt-3 text-sm text-muted">Given to {andList(charities)}, for typical US use.</p>
      )}
    </div>
  );
}

const throughDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** What the person receiving a gift was given: each item and how long, what it offsets in all, and where the money went. */
function GiftDetails({ gift }: { gift: Gift }) {
  const items = GIFTABLE.filter((p) => gift.items.some((i) => i.productId === p.id));
  const impacts = giftImpacts(gift.items, gift.birthYear);
  const shown = IMPACT_KEYS.filter((k) => impacts[k] > 0);
  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="gift-items">
        <h2 id="gift-items" className="text-lg font-bold">
          What it offsets
        </h2>
        <ul className="mt-1 divide-y divide-border border-y border-border text-sm">
          {items.map((p) => {
            const item = gift.items.find((i) => i.productId === p.id)!;
            const until = giftUntil(item, gift.createdAt);
            return (
              <li key={p.id} className="flex justify-between gap-3 py-1.5">
                <span>{p.name}</span>
                <span className="shrink-0 text-right">{until ? `through ${throughDate(until)}` : "for life"}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {shown.length > 0 && (
        <section aria-labelledby="gift-impacts">
          <h2 id="gift-impacts" className="text-lg font-bold">
            In all, at typical US use
          </h2>
          <dl className="mt-1 divide-y divide-border border-y border-border text-sm">
            {shown.map((k) => (
              <div key={k} className="flex justify-between gap-3 py-1.5">
                <dt>{IMPACT_INFO[k].label}</dt>
                <dd className="figures text-right">{IMPACT_INFO[k].format(impacts[k], impacts)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section aria-labelledby="gift-charities">
        <h2 id="gift-charities" className="text-lg font-bold">
          Where the money went
        </h2>
        <p className="mt-1 text-sm">
          {andList(giftCharities(gift.items, gift.birthYear))}.{" "}
          <Link href="/ledger" className="underline underline-offset-4 hover:text-muted">
            What each one does
          </Link>
        </p>
      </section>
    </div>
  );
}

/** What one item costs for a span, before fees and minimums, for the picker. */
function itemPrice(p: Product, span: GiftSpan, birthYear: number) {
  const ctx = giftContext(birthYear);
  const amount = defaultAmount(p, ctx);
  if (span === "life") return p.cost(amount, "future", ctx);
  return p.cost(amount, "monthly", ctx) * (spanMonths(span) ?? 0);
}

/** Choosing a gift and paying for it, at /gift. */
export function GiftMaker() {
  const [picks, setPicks] = useState<Picks>({ ai: "life" });
  const [birth, setBirth] = useState<number | undefined>(undefined);
  const [from, setFrom] = useState("");
  const [names, setNames] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [started, setStarted] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The total the giver has checked; a big gift waits for this, as the store does.
  const [checked, setChecked] = useState<number | null>(null);
  useEffect(() => setStarted(loadGift()), []);

  if (started && paymentsOn()) {
    return (
      <div className="mt-6">
        <p>
          You have a gift in progress.{" "}
          <Link href={`/gift/${started.id}`} className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
            Go back to it
          </Link>{" "}
          or{" "}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Start a new gift? The one in progress stays at its own link, but this browser forgets it.")) return;
              saveGift(null);
              setStarted(null);
            }}
            className="cursor-pointer underline underline-offset-4 hover:text-muted"
          >
            start a new one
          </button>
          .
        </p>
      </div>
    );
  }

  const birthYear = birth && birth > 1900 && birth <= new Date().getFullYear() ? birth : DEFAULT_CONTEXT.birthYear;
  const items = toItems(picks);
  const people = Math.max(1, names.filter((n) => n.trim()).length);
  // Every.org rows, or one gift to the fund: the same switch as the store's checkout (Ian, 2026-10-13).
  const charge = giftCharge(items, birthYear, people);
  const { rows, fund } = charge;
  const ready = rows.length > 0 || !!fund;
  const gifts = fund ? 1 : rows.length;
  const everydayForLife = items.some((i) => i.span === "life" && !productById(i.productId)?.oneTime);
  const total = chargeTotal(charge);
  const forPeople = people > 1 ? ` for ${people} people` : "";
  const checking = total > GIFT_CONFIRM_OVER_USD && checked === total;
  const start = async () => {
    setError(null);
    setBusy(true);
    const id = newPlanId();
    try {
      const r = await fetch("/api/gifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, items, birthYear, from, to: names.map((n) => n.trim()).filter(Boolean), note }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save the gift.");
      const c: Checkout = { id, created: new Date().toISOString(), billing: "monthly", rows, lines: [], done: {}, confirmed: {}, returnPath: `/gift/${id}`, ...(fund ? { fund } : {}) };
      saveGift(c);
      window.location.assign(`/gift/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the gift.");
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!paymentsOn()) return;
        if (total > GIFT_CONFIRM_OVER_USD && !checking) setChecked(total);
        else start();
      }}
    >
      <fieldset>
        <legend className="font-semibold">What to offset</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
          {GIFT_PRESETS.map((preset) => {
            const chosen = presetItems(preset);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPicks(Object.fromEntries(chosen.map((i) => [i.productId, i.span])))}
                className="min-h-10 cursor-pointer text-left font-semibold underline underline-offset-4 hover:text-muted"
              >
                {preset.label} · <span className="figures">{usd(chargeTotal(giftCharge(chosen, birthYear)))}</span>
              </button>
            );
          })}
          {items.length > 0 && (
            <button type="button" onClick={() => setPicks({})} className="min-h-10 cursor-pointer text-muted underline underline-offset-4 hover:text-foreground">
              Clear
            </button>
          )}
        </div>
        {SECTIONS.map((sec) => {
          const ps = GIFTABLE.filter((p) => p.section === sec.key);
          if (!ps.length) return null;
          return (
            <div key={sec.key} className="mt-3">
              <h2 className="text-sm font-bold">{sec.title}</h2>
              <ul className="divide-y divide-border border-y border-border">
                {ps.map((p) => {
                  const span = picks[p.id];
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!span}
                          onChange={(e) =>
                            setPicks((x) => {
                              const next = { ...x };
                              if (e.target.checked) next[p.id] = defaultGiftSpan(p);
                              else delete next[p.id];
                              return next;
                            })
                          }
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                        />
                        {p.name}
                      </label>
                      {span && (
                        <span className="flex items-center gap-2">
                          <select
                            aria-label={`How long to offset ${p.name}`}
                            value={span}
                            onChange={(e) => setPicks((x) => ({ ...x, [p.id]: e.target.value as GiftSpan }))}
                            className="min-h-10 cursor-pointer rounded-md border border-border bg-background px-2"
                          >
                            {GIFT_SPANS.map((sp) => (
                              <option key={sp} value={sp}>
                                {SPAN_LABEL[sp].replace(/^for /, "For ")}
                              </option>
                            ))}
                          </select>
                          <span className="figures w-20 text-right">{usd(itemPrice(p, span, birthYear))}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="mt-2 text-sm text-muted">
          {people > 1 && `Prices are for each person. `}At typical use. If they measure theirs and it&apos;s higher, they can offset the rest.
          {everydayForLife && " Everyday items for life assume today's habits until age 85, which is a rough guess."}
        </p>
      </fieldset>
      <label className="block max-w-56">
        <span className="font-semibold">Their birth year</span> <span className="text-muted">(optional)</span>
        <input
          type="number"
          inputMode="numeric"
          value={birth ?? ""}
          onChange={(e) => setBirth(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={String(DEFAULT_CONTEXT.birthYear)}
          className={inputClass}
        />
        <span className="mt-1 block text-sm text-muted">
          Sets how many years &ldquo;for life&rdquo; runs{people > 1 ? ", for everyone on this gift" : ""}.
        </span>
      </label>
      <label className="block sm:max-w-[calc(50%-0.5rem)]">
        <span className="font-semibold">Your name</span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={GIFT_LIMITS.from} required className={inputClass} />
      </label>
      <fieldset>
        <legend className="font-semibold">Who it&apos;s for</legend>
        <p className="text-sm text-muted">One gift is for everyone here, and each person gets their own card link.</p>
        <ul className="mt-1 space-y-2">
          {names.map((n, i) => (
            <li key={i} className="flex items-center gap-3">
              <input
                aria-label={names.length > 1 ? `Person ${i + 1}'s name` : "Their name"}
                placeholder="Their name"
                value={n}
                onChange={(e) => setNames((x) => x.map((v, j) => (j === i ? e.target.value : v)))}
                maxLength={GIFT_LIMITS.to}
                required={i === 0}
                className={`${inputClass} mt-0 sm:max-w-[calc(50%-0.5rem)]`}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => setNames((x) => x.filter((_, j) => j !== i))}
                  className="min-h-10 cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-foreground"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {names.length < GIFT_LIMITS.people && (
          <button
            type="button"
            onClick={() => setNames((x) => [...x, ""])}
            className="mt-1 min-h-10 cursor-pointer text-sm font-semibold underline underline-offset-4 hover:text-muted"
          >
            Add another person
          </button>
        )}
      </fieldset>
      <label className="block">
        <span className="font-semibold">A note</span> <span className="text-muted">(optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={GIFT_LIMITS.note} rows={2} className={`${inputClass} py-2`} />
      </label>
      <GiftCard gift={{ items, from, to: names.find((n) => n.trim()) ?? "", note, birthYear }} />
      {people > 1 && <p className="-mt-3 text-sm text-muted">Each person gets a card like this with their own name.</p>}
      <p className="text-sm text-muted">
        {forMode({
          every: "Every.org emails you a receipt for each charity.",
          pledge: "Pledge emails you a receipt for each charity.",
          sponsor: "Each charity emails you a receipt.",
          endaoment: "Endaoment emails you the tax receipt.",
        })}{" "}
        The names and note
        are kept with the gift so its link can show them; nothing is sent to anyone.
      </p>
      {error && (
        <p role="alert" className="font-semibold">
          {error}
        </p>
      )}
      {paymentsOn() ? (
        <div>
          {ready && <p className="mb-3">{giftSteps(gifts, people, PAYMENT_MODE)}</p>}
          {checking ? (
            <div className="border-y-2 border-rule py-3 text-sm">
              <p className="font-semibold">
                You&apos;re giving <span className="figures">{usd(total)}</span>
                {forPeople}
                {fund ? " in one gift to the fund at Endaoment" : ` to ${rows.length} charit${rows.length === 1 ? "y" : "ies"}`}.
              </p>
              <p className="mt-1 text-muted">
                A check before anything opens, since it&apos;s a big gift.{fund ? "" : PAYMENT_MODE === "pledge" ? " Each charity's form shows its own part again." : " Each charity's page shows its own part again."}
              </p>
              <button
                type="submit"
                disabled={busy}
                className="mt-2 min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85 disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={busy || !ready}
              className="min-h-11 cursor-pointer rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
            >
              {ready ? `Give this gift (${usd(total)}${forPeople}, fees included)` : "Pick something to offset"}
            </button>
          )}
        </div>
      ) : (
        <p className="font-semibold">
          {ready ? `This gift comes to ${usd(total)}${forPeople}, fees included. ` : ""}Payments open soon, and gifts with them.
        </p>
      )}
    </form>
  );
}

/** Marks the gifted items as covered in this browser's plan. */
function acceptGift(gift: Gift) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { covered?: Record<string, Covered> };
    const covered = { ...saved.covered };
    for (const item of gift.items) {
      const until = giftUntil(item, gift.createdAt);
      covered[item.productId] = until
        ? { kind: "period", until, giftFrom: gift.from, since: gift.createdAt }
        : { kind: "life", giftFrom: gift.from, since: gift.createdAt };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, covered }));
    return true;
  } catch {
    return false;
  }
}

/** A gift's own page, /gift/<id>: paying for it if this browser is the giver's, the card and a way to accept it otherwise. */
/** The recipient, not the giver, decides whether a gift puts them on the public list (Ian, 2026-10-12). */
function GiftListing({ giftId, n }: { giftId: string; n: number }) {
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [listed, setListed] = useState(false);
  useEffect(() => setListed(!!savedListing()), []);
  // Already on the list from this browser: offer to add this gift, or change or leave.
  if (listed)
    return (
      <div className="mt-6 border-t-2 border-rule pt-1">
        <ListInvite what="this gift" join={(name) => joinList(name, { source: "gift", giftId, for: n })} />
      </div>
    );
  return (
    <div className="mt-6 border-t-2 border-rule pt-3">
      <ListOptIn label="Show me on Who's offsetting" onChange={setName} />
      {name && !note && (
        <button
          type="button"
          onClick={() => joinList(name, { source: "gift", giftId, for: n }).then((err) => setNote(err ?? `You're on Who's offsetting as ${name}.`))}
          className="ml-6 mt-2 min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 text-sm font-semibold hover:bg-foreground hover:text-background"
        >
          Add me
        </button>
      )}
      {note && (
        <p role="status" className="mt-2 text-sm">
          {note} <Link href="/list/edit" className="underline">Change or leave</Link>
        </p>
      )}
    </div>
  );
}

export function GiftView({ id }: { id: string }) {
  const [state, setState] = useState<{ gift: Gift; paid: boolean } | "missing" | "error" | null>(null);
  const [mine, setMine] = useState<Checkout | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    // Coming back from Every.org: mark that charity's gift as given.
    const q = new URLSearchParams(window.location.search);
    setN(Math.max(0, Number(q.get("for")) || 0));
    const saved = loadGift();
    if (saved?.id === id) {
      const gave = q.get("charity");
      const row = saved.rows.find((r) => r.key === gave);
      const c = row && !saved.done[row.key] ? { ...saved, done: { ...saved.done, [row.key]: new Date().toISOString() } } : saved;
      saveGift(c);
      setMine(c);
    }
    fetch(`/api/gifts/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => (r.status === 404 ? "missing" : r.ok ? ((await r.json()) as { gift: Gift; paid: boolean }) : "error"))
      .then(setState)
      .catch(() => setState("error"));
  }, [id]);

  if (!state) return <p className="text-muted">Loading the gift…</p>;
  if (state === "missing") return <p>I couldn&apos;t find this gift. Check the link is complete.</p>;
  if (state === "error") return <p>I couldn&apos;t load this gift just now. Try again in a minute.</p>;
  const { gift } = state;
  const names = recipients(gift);
  const paid = state.paid || (mine ? allConfirmed(mine) : false);

  if (mine) {
    const toAll = andList(names);
    return (
      <div>
        <h1 className="text-3xl font-extrabold [font-stretch:85%]">Your gift for {toAll}</h1>
        <div className="mt-6">
          <GiftCard gift={{ ...gift, to: names[0] ?? "" }} />
        </div>
        <h2 className="mt-8 text-lg font-bold">{paid ? "Given" : mine.fund ? "Give through Endaoment" : "Give to each charity"}</h2>
        <div className="mt-2">
          {mine.fund ? <FundSteps checkout={mine} save={saveGift} onChange={setMine} /> : <CheckoutSteps checkout={mine} save={saveGift} onChange={setMine} />}
          {paid && <ListInvite />}
        </div>
        <div className="mt-8 border-t-2 border-rule pt-4">
          <h2 className="text-lg font-bold">Send it</h2>
          <p className="mt-1 text-sm text-muted">
            {paid
              ? `Send ${names.length > 1 ? "each person their own link" : `${toAll} this link`} however you like. It shows the card and what it offsets, and lets them save it in their browser.`
              : `The ${names.length > 1 ? "links work" : "link works"} once ${mine.fund ? "your gift is" : "every charity's gift is"} confirmed. Until then ${names.length > 1 ? "they say" : "it says"} the gift is still on its way.`}
          </p>
          <ul className="mt-2 space-y-2">
            {names.map((name, i) => {
              const link = `${window.location.origin}${giftPath(id, i, names.length)}`;
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {names.length > 1 && <span className="font-semibold">{name}</span>}
                  <code className="figures break-all text-sm">{link}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(i))}
                    className="min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 text-sm font-semibold hover:bg-foreground hover:text-background"
                  >
                    {copied === i ? "Copied" : names.length > 1 ? `Copy ${name}'s link` : "Copy link"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div>
      <GiftCard gift={{ ...gift, to: names[Math.min(n, names.length - 1)] ?? "" }} heading />
      {paid && <GiftDetails gift={gift} />}
      {paid ? (
        accepted ? (
          <p className="mt-6">
            Done. {gift.items.length === 1 ? "It shows" : "They show"} as offset on{" "}
            <Link href="/" className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
              My Offset
            </Link>{" "}
            in this browser. If you measure your own use and it&apos;s higher, you can offset the rest there.
          </p>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setAccepted(acceptGift(gift))}
              className="min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85"
            >
              Save to this browser
            </button>
            {accepted === false && <p className="mt-2 text-sm">This browser won&apos;t let the site save it. Try another browser.</p>}
            <p className="mt-2 text-sm text-muted">Saved only here. Nothing signs you up or is sent anywhere.</p>
          </div>
        )
      ) : null}
      {paid && <GiftListing giftId={gift.id} n={Math.min(n, names.length - 1)} />}
      {paid ? null : (
        <p className="mt-6 font-semibold">This gift is still on its way to the charities. Check back soon.</p>
      )}
    </div>
  );
}
