"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutSteps } from "./Checkout";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import { GIFT_LIMITS, GIFTABLE, type Gift, giftLabel, giftRows, giftSpans, type GiftSpan } from "@/lib/gifts";
import { allConfirmed, type Checkout, newPlanId, paymentsOn, PLAN_ID, sumTotal } from "@/lib/payments";
import { usd } from "@/lib/pricing";
import { productById } from "@/lib/store";

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

/** "driving", but "AI chat" keeps its capitals. */
const lower = (name: string) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

const inputClass = "mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3";

/** The gift as its card reads, for both the giver's preview and the person receiving it. */
function GiftCard({ gift }: { gift: Pick<Gift, "productId" | "span" | "from" | "to" | "note"> }) {
  return (
    <div className="border-y-4 border-rule py-5">
      <p className="text-sm text-muted">A gift for {gift.to || "someone"}</p>
      <p className="mt-1 text-2xl font-extrabold [font-stretch:85%]">
        {gift.from || "Someone"} covered your {lower(giftLabel(gift))}.
      </p>
      {gift.note && <p className="mt-3 whitespace-pre-line">&ldquo;{gift.note}&rdquo;</p>}
      <p className="mt-3 text-sm text-muted">
        Paid to the charities on My Offset for typical US use of {lower(productById(gift.productId)?.name ?? "this item")}: its
        carbon, air pollution, water, nature and e-waste.
      </p>
    </div>
  );
}

/** Choosing a gift and paying for it, at /gift. */
export function GiftMaker() {
  const [productId, setProductId] = useState("ai");
  const [span, setSpan] = useState<GiftSpan>("life");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [started, setStarted] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setStarted(loadGift()), []);

  if (!paymentsOn()) return <p className="mt-6 font-semibold">Gifts open when payments do.</p>;
  if (started) {
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

  const product = productById(productId) ?? GIFTABLE[0];
  const spans = giftSpans(product);
  const chosen = spans.includes(span) ? span : spans[0];
  const rows = giftRows(product.id, chosen);
  const start = async () => {
    setError(null);
    setBusy(true);
    const id = newPlanId();
    try {
      const r = await fetch("/api/gifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, productId: product.id, span: chosen, from, to, note }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save the gift.");
      const c: Checkout = {
        id,
        created: new Date().toISOString(),
        billing: "annual",
        rows,
        lines: [],
        done: {},
        confirmed: {},
        returnPath: `/gift/${id}`,
      };
      saveGift(c);
      window.location.assign(`/gift/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the gift.");
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start();
      }}
    >
      <label className="block">
        <span className="font-semibold">What to cover</span>
        <select value={product.id} onChange={(e) => setProductId(e.target.value)} className={`${inputClass} cursor-pointer`}>
          {GIFTABLE.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="font-semibold">For how long</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {spans.map((s) => {
            const total = sumTotal(giftRows(product.id, s));
            return (
              <label
                key={s}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 ${
                  chosen === s ? "border-rule bg-foreground text-background" : "border-border hover:border-rule"
                }`}
              >
                <input type="radio" name="span" value={s} checked={chosen === s} onChange={() => setSpan(s)} className="sr-only" />
                {s === "life" ? "For life" : "For a year"} <span className="figures">{usd(total)}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-sm text-muted">At typical use. If they measure theirs and it&apos;s higher, they can cover the rest.</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-semibold">Your name</span>
          <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={GIFT_LIMITS.from} required className={inputClass} />
        </label>
        <label className="block">
          <span className="font-semibold">Their name</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={GIFT_LIMITS.to} required className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className="font-semibold">A note</span> <span className="text-muted">(optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={GIFT_LIMITS.note} rows={2} className={`${inputClass} py-2`} />
      </label>
      <GiftCard gift={{ productId: product.id, span: chosen, from, to, note }} />
      <p className="text-sm text-muted">
        You pay each charity through Every.org, which emails you the receipts. The names and note are kept with the gift so its link can
        show them; nothing is sent to anyone.
      </p>
      {error && (
        <p role="alert" className="font-semibold">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !rows.length}
        className="min-h-11 cursor-pointer rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
      >
        Pay for this gift ({usd(sumTotal(rows))})
      </button>
    </form>
  );
}

/** Marks the gifted item as covered in this browser's plan. */
function acceptGift(gift: Gift) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { covered?: Record<string, Covered> };
    const until = new Date(gift.createdAt);
    until.setFullYear(until.getFullYear() + 1);
    const covered: Covered = gift.span === "life" ? { kind: "life", giftFrom: gift.from } : { kind: "period", until: until.toISOString(), giftFrom: gift.from };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, covered: { ...saved.covered, [gift.productId]: covered } }));
    return true;
  } catch {
    return false;
  }
}

/** A gift's own page, /gift/<id>: paying for it if this browser is the giver's, the card and a way to accept it otherwise. */
export function GiftView({ id }: { id: string }) {
  const [state, setState] = useState<{ gift: Gift; paid: boolean } | "missing" | "error" | null>(null);
  const [mine, setMine] = useState<Checkout | null>(null);
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    // Coming back from Every.org: mark that charity's gift as given.
    const q = new URLSearchParams(window.location.search);
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
  const paid = state.paid || (mine ? allConfirmed(mine) : false);

  if (mine) {
    const link = `${window.location.origin}/gift/${id}`;
    return (
      <div>
        <h1 className="text-3xl font-extrabold [font-stretch:85%]">Your gift for {gift.to}</h1>
        <div className="mt-6">
          <GiftCard gift={gift} />
        </div>
        <h2 className="mt-8 text-lg font-bold">{paid ? "Paid" : "Pay each charity"}</h2>
        <div className="mt-2">
          <CheckoutSteps checkout={mine} save={saveGift} onChange={setMine} />
        </div>
        <div className="mt-8 border-t-2 border-rule pt-4">
          <h2 className="text-lg font-bold">Send it</h2>
          <p className="mt-1 text-sm text-muted">
            {paid
              ? `Send ${gift.to} this link however you like. It shows the card and lets them mark it as covered.`
              : "The link works once every charity's gift is confirmed. Until then it says the gift is still being paid for."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="figures break-all text-sm">{link}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true))}
              className="min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 text-sm font-semibold hover:bg-foreground hover:text-background"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <GiftCard gift={gift} />
      {paid ? (
        accepted ? (
          <p className="mt-6">
            Done. {giftLabel(gift)} shows as covered in{" "}
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
      ) : (
        <p className="mt-6 font-semibold">This gift is still being paid for. Check back soon.</p>
      )}
    </div>
  );
}
