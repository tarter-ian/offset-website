"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Seal } from "./Badge";
import { CheckoutSteps } from "./Checkout";
import { joinList, ListInvite, ListOptIn, savedListing } from "./ListOptIn";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import {
  defaultGiftSpan,
  GIFT_LIMITS,
  GIFT_SPANS,
  GIFTABLE,
  type Gift,
  giftContext,
  type GiftItem,
  giftPath,
  giftRows,
  giftSentence,
  type GiftSpan,
  giftUntil,
  recipients,
  SPAN_LABEL,
  spanMonths,
} from "@/lib/gifts";
import { badgesFor } from "@/lib/badges";
import { allConfirmed, type Checkout, newPlanId, paymentsOn, PLAN_ID, sumTotal } from "@/lib/payments";
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

/** The gift as its card reads, for both the giver's preview and the person receiving it. */
function GiftCard({ gift }: { gift: Pick<Gift, "items" | "from" | "to" | "note"> & { createdAt?: string } }) {
  const from = gift.createdAt ?? new Date().toISOString();
  const seals = badgesFor(gift.items.map((i) => ({ productId: i.productId, until: giftUntil(i, from) })));
  return (
    <div className="border-y-4 border-rule py-5">
      <p className="text-sm text-muted">A gift for {gift.to || "someone"}</p>
      <p className="mt-1 text-2xl font-extrabold [font-stretch:85%]">
        {gift.from || "Someone"} covered {giftSentence(gift.items) || "something for you"}.
      </p>
      {gift.note && <p className="mt-3 whitespace-pre-line">&ldquo;{gift.note}&rdquo;</p>}
      {seals.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {seals.map((b) => (
            <Seal key={b.key} kind={b.kind} name={b.name} until={b.until} />
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-muted">
        Paid to the charities on My Offset at typical US use: the carbon, air pollution, water, nature and e-waste behind each one.
      </p>
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
  const rows = items.length ? giftRows(items, birthYear, people) : [];
  const everydayForLife = items.some((i) => i.span === "life" && !productById(i.productId)?.oneTime);
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
      const c: Checkout = { id, created: new Date().toISOString(), billing: "monthly", rows, lines: [], done: {}, confirmed: {}, returnPath: `/gift/${id}` };
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
        if (paymentsOn()) start();
      }}
    >
      <fieldset>
        <legend className="font-semibold">What to cover</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
          <button
            type="button"
            onClick={() => setPicks(Object.fromEntries(GIFTABLE.map((p) => [p.id, defaultGiftSpan(p)])))}
            className="min-h-10 cursor-pointer font-semibold underline underline-offset-4 hover:text-muted"
          >
            Choose everything
          </button>
          {(["month", "year", "life"] as const).map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setPicks(Object.fromEntries(GIFTABLE.map((p) => [p.id, sp])))}
              className="min-h-10 cursor-pointer font-semibold underline underline-offset-4 hover:text-muted"
            >
              Everything, {SPAN_LABEL[sp]}
            </button>
          ))}
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
              <h3 className="text-sm font-bold">{sec.title}</h3>
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
                            aria-label={`How long to cover ${p.name}`}
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
          {people > 1 && `Prices are for each person. `}At typical use. If they measure theirs and it&apos;s higher, they can cover the rest.
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
          Sets how many years &ldquo;for life&rdquo; covers{people > 1 ? ", for everyone on this gift" : ""}.
        </span>
      </label>
      <label className="block sm:max-w-[calc(50%-0.5rem)]">
        <span className="font-semibold">Your name</span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={GIFT_LIMITS.from} required className={inputClass} />
      </label>
      <fieldset>
        <legend className="font-semibold">Who it&apos;s for</legend>
        <p className="text-sm text-muted">One payment covers everyone here, and each person gets their own card link.</p>
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
      <GiftCard gift={{ items, from, to: names.find((n) => n.trim()) ?? "", note }} />
      {people > 1 && <p className="-mt-3 text-sm text-muted">Each person gets a card like this with their own name.</p>}
      <p className="text-sm text-muted">
        You give to each charity through Every.org, which emails you the receipts. The names and note are kept with the gift so its link can
        show them; nothing is sent to anyone.
      </p>
      {error && (
        <p role="alert" className="font-semibold">
          {error}
        </p>
      )}
      {paymentsOn() ? (
        <button
          type="submit"
          disabled={busy || !rows.length}
          className="min-h-11 cursor-pointer rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
        >
          {rows.length ? `Pay for this gift (${usd(sumTotal(rows))}${people > 1 ? ` for ${people} people` : ""}, fees included)` : "Pick something to cover"}
        </button>
      ) : (
        <p className="font-semibold">
          {rows.length ? `This gift comes to ${usd(sumTotal(rows))}${people > 1 ? ` for ${people} people` : ""}, fees included. ` : ""}Payments open soon, and gifts with them.
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
      <ListOptIn label="Show me on the public list" onChange={setName} />
      {name && !note && (
        <button
          type="button"
          onClick={() => joinList(name, { source: "gift", giftId, for: n }).then((err) => setNote(err ?? `You're on the public list as ${name}.`))}
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
  if (state === "missing") return <p>We couldn&apos;t find this gift. Check the link is complete.</p>;
  if (state === "error") return <p>We couldn&apos;t load this gift just now. Try again in a minute.</p>;
  const { gift } = state;
  const names = recipients(gift);
  const paid = state.paid || (mine ? allConfirmed(mine) : false);

  if (mine) {
    const toAll = names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return (
      <div>
        <h1 className="text-3xl font-extrabold [font-stretch:85%]">Your gift for {toAll}</h1>
        <div className="mt-6">
          <GiftCard gift={{ ...gift, to: names[0] ?? "" }} />
        </div>
        <h2 className="mt-8 text-lg font-bold">{paid ? "Given" : "Give to each charity"}</h2>
        <div className="mt-2">
          <CheckoutSteps checkout={mine} save={saveGift} onChange={setMine} />
          {paid && <ListInvite />}
        </div>
        <div className="mt-8 border-t-2 border-rule pt-4">
          <h2 className="text-lg font-bold">Send it</h2>
          <p className="mt-1 text-sm text-muted">
            {paid
              ? `Send ${names.length > 1 ? "each person their own link" : `${toAll} this link`} however you like. It shows the card and lets them mark it as covered.`
              : `The ${names.length > 1 ? "links work" : "link works"} once every charity's gift is confirmed. Until then ${names.length > 1 ? "they say" : "it says"} the gift is still being paid for.`}
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
      <GiftCard gift={{ ...gift, to: names[Math.min(n, names.length - 1)] ?? "" }} />
      {paid ? (
        accepted ? (
          <p className="mt-6">
            Done. {gift.items.length === 1 ? "It shows" : "They show"} as covered in{" "}
            <Link href="/" className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
              your plan
            </Link>
            . If you measure your own use and it&apos;s higher, you can cover the rest there.
          </p>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setAccepted(acceptGift(gift))}
              className="min-h-11 cursor-pointer rounded-md bg-foreground px-4 font-semibold text-background hover:opacity-85"
            >
              Add to my plan as covered
            </button>
            {accepted === false && <p className="mt-2 text-sm">This browser won&apos;t let us save it. Try another browser.</p>}
            <p className="mt-2 text-sm text-muted">Saved only in this browser, like the rest of your plan.</p>
          </div>
        )
      ) : null}
      {paid && <GiftListing giftId={gift.id} n={Math.min(n, names.length - 1)} />}
      {paid ? null : (
        <p className="mt-6 font-semibold">This gift is still being paid for. Check back soon.</p>
      )}
    </div>
  );
}
