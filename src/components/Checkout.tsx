"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHARITIES } from "@/lib/charities";
import { IMPACT_INFO } from "@/lib/impacts";
import {
  allConfirmed,
  type Checkout,
  fetchConfirmed,
  forMode,
  frequencyText,
  FUND_KEY,
  fundLink,
  harmsText,
  nextRow,
  onePayment,
  payLink,
  PAYMENT_MODE,
  type PayRow,
  PLEDGE_EINS,
  pledgeCompleted,
  pledgeFormUrl,
  PLEDGE_PREFILL_MIN_USD,
  pledgePartnerKey,
  saveCheckout,
} from "@/lib/payments";
import { ENDAOMENT_GRANT_LABEL, ENDAOMENT_IN_LABEL, PLEDGE_API_CARD_LABEL, PLEDGE_API_FEE_LABEL, STRIPE_CARD_LABEL, usd } from "@/lib/pricing";

const harmLabel = (k: keyof typeof IMPACT_INFO) => IMPACT_INFO[k].label.toLowerCase();
const POLL_MS = 5000;
const POLLS = 24;

/** The green button that opens Every.org for one gift. Never opened for the person: browsers block pop-ups, and it should be their tap. */
export function GiveButton({ planId, row, onGo, returnPath }: { planId: string; row: PayRow; onGo?: () => void; returnPath?: string }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => setHref(payLink(planId, row, window.location.origin, "every", returnPath)), [planId, row, returnPath]);
  if (!href) return null;
  return (
    <a
      href={href}
      onClick={onGo}
      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
    >
      Give {usd(row.total)}
    </a>
  );
}

/** One charity's line: who, what it covers, how much, and where it stands. */
function StepRow({
  row,
  status,
  action,
  children,
}: {
  row: PayRow;
  status: "next" | "later" | "waiting" | "confirmed";
  action?: React.ReactNode;
  /** Shown full width under the row: Pledge's form for the next charity. */
  children?: React.ReactNode;
}) {
  const c = CHARITIES[row.charity];
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span aria-hidden className="figures w-4 shrink-0 text-muted">
            {status === "confirmed" || status === "waiting" ? "✓" : "○"}
          </span>
          <a href={c.url} target="_blank" rel="noreferrer" className="cursor-pointer font-semibold underline underline-offset-2 hover:text-muted">
            {c.name}
          </a>
        </span>
        <span className="block pl-6 text-muted">
          Covers {harmsText(row.harms, harmLabel)} ·{" "}
          <span className="figures">
            {PAYMENT_MODE === "pledgeapi"
              ? usd(row.donation)
              : row.fee > 0
                ? `${usd(row.donation)} + ${usd(row.fee)} card fee`
                : `${usd(row.donation)}, no card fee`}
          </span>
          {row.frequency !== "ONCE" && `, ${frequencyText(row)} until you stop it`}
        </span>
        {status === "waiting" && <span className="block pl-6 text-muted">Given, waiting for confirmation</span>}
        {status === "confirmed" && (
          <span className="block pl-6 font-semibold text-life-ink">
            {forMode({ every: "Given and confirmed by Every.org", pledge: "Given and confirmed by Pledge", pledgeapi: "Given and confirmed by Pledge", endaoment: "Given and confirmed", sponsor: "Given and confirmed" })}
          </span>
        )}
      </span>
      {action ?? (status === "later" && <span className="figures text-muted">{usd(row.total)}</span>)}
      {children && <div className="basis-full">{children}</div>}
    </li>
  );
}

/**
 * A gift's one payment to the Endaoment fund: what each charity gets, the fees, and one
 * Give button that opens the fund in a new tab. Looks once for a confirmation under the
 * fund's key, the same record the store's checkout waits on; until Endaoment can send one
 * (see fundLink), the gift stays given and pending.
 */
export function FundSteps({ checkout, onChange, save }: { checkout: Checkout; onChange: (c: Checkout) => void; save: (c: Checkout) => void }) {
  const [href, setHref] = useState<string | null>(null);
  const latest = useRef({ checkout, onChange, save });
  useEffect(() => {
    latest.current = { checkout, onChange, save };
  });
  useEffect(() => setHref(fundLink()), []);
  useEffect(() => {
    let stopped = false;
    fetchConfirmed(checkout.id).then((paid) => {
      const { checkout: c, onChange: change, save: keep } = latest.current;
      if (stopped || !paid.includes(FUND_KEY) || c.confirmed[FUND_KEY]) return;
      const next = { ...c, confirmed: { ...c.confirmed, [FUND_KEY]: true as const } };
      keep(next);
      change(next);
    });
    return () => {
      stopped = true;
    };
  }, [checkout.id]);
  const gift = checkout.fund;
  if (!gift) return null;
  const confirmed = !!checkout.confirmed[FUND_KEY];
  const given = !!checkout.done[FUND_KEY];
  return (
    <div className="text-sm">
      <dl className="figures space-y-1 border-y-2 border-rule py-3">
        {gift.parts.map((p) => (
          <div key={p.charity} className="flex justify-between gap-4">
            <dt className="font-sans text-muted">
              {CHARITIES[p.charity].name} ({harmsText(p.harms, harmLabel)})
            </dt>
            <dd className="shrink-0 text-right">{usd(p.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <dt className="font-sans text-muted">
            Endaoment fees ({ENDAOMENT_IN_LABEL} in, {ENDAOMENT_GRANT_LABEL} to grant it out)
          </dt>
          <dd className="shrink-0 text-right">{usd(gift.endaoment)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-sans text-muted">Card fee (estimated)</dt>
          <dd className="shrink-0 text-right">{usd(gift.card)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
          <dt className="font-sans">Total, one gift</dt>
          <dd>{usd(gift.total)}</dd>
        </div>
      </dl>
      {confirmed ? (
        <p role="status" className="mt-3 font-semibold text-life-ink">
          Given and confirmed. Thank you. Endaoment emails your tax receipt.
        </p>
      ) : given ? (
        <p role="status" className="mt-3">
          <span className="font-semibold">
            <span aria-hidden>✓ </span>Given <span className="figures">{usd(gift.total)}</span>, pending confirmation
          </span>
          <span className="block text-muted">Endaoment emails your tax receipt. The gift link works once I can confirm the gift with Endaoment.</span>
        </p>
      ) : href ? (
        <div className="mt-3">
          <a
            href={href}
            target="_blank"
            rel="noopener"
            onClick={() => {
              const next = { ...checkout, done: { ...checkout.done, [FUND_KEY]: new Date().toISOString() } };
              save(next);
              onChange(next);
            }}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong"
          >
            Give {usd(gift.total)}
          </a>
          <p className="mt-2 text-muted">
            Opens the My Offset fund on Endaoment in a new tab. Give <span className="figures">{usd(gift.total)}</span> there, and Endaoment grants
            each charity its part.
          </p>
        </div>
      ) : (
        <p className="mt-3 font-semibold">Giving through Endaoment opens soon.</p>
      )}
      <p className="mt-2 text-muted">
        Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what I promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>. None of it passes through My Offset.
      </p>
    </div>
  );
}

interface StepsProps {
  checkout: Checkout;
  onChange: (c: Checkout) => void;
  /** Where progress is kept: the plan's checkout by default, or a gift's. */
  save?: (c: Checkout) => void;
  /** Called as the person gives the first time, before progress is saved: on tapping Give, or when Pledge reports a gift. */
  onGo?: () => void;
  /** False for a list not yet started, which has nothing to look up. */
  saved?: boolean;
}

/**
 * A checkout in progress, one gift per charity: Every.org's Give buttons, Pledge's forms in pledge mode,
 * or one Stripe payment for all of them in pledgeapi mode.
 */
export function CheckoutSteps(props: StepsProps) {
  return PAYMENT_MODE === "pledge" ? <PledgeSteps {...props} /> : PAYMENT_MODE === "pledgeapi" ? <PledgeApiSteps {...props} /> : <EverySteps {...props} />;
}

/**
 * A checkout in progress: every gift in order, with a Give button on the next
 * one only. Checks with the server which gifts Every.org has confirmed, and keeps
 * checking for a while after the person comes back.
 */
function EverySteps({
  checkout,
  onChange,
  onGo,
  saved = true,
  save = saveCheckout,
}: StepsProps) {
  const waiting = checkout.rows.some((r) => checkout.done[r.key] && !checkout.confirmed[r.key]);
  const latest = useRef({ checkout, onChange, save });
  useEffect(() => {
    latest.current = { checkout, onChange, save };
  });
  // Look once when the list opens, then keep looking while a gift waits for confirmation.
  useEffect(() => {
    if (!saved) return;
    let polls = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const { checkout: c, onChange: change } = latest.current;
      const paid = await fetchConfirmed(c.id);
      if (stopped) return;
      const fresh = paid.filter((k) => !c.confirmed[k] && c.rows.some((r) => r.key === k));
      if (fresh.length) {
        const next = { ...c, confirmed: { ...c.confirmed, ...Object.fromEntries(fresh.map((k) => [k, true as const])) } };
        latest.current.save(next);
        change(next);
      } else if (waiting && ++polls < POLLS) timer = setTimeout(check, POLL_MS);
    };
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [checkout.id, saved, waiting]);

  const next = nextRow(checkout);
  const done = allConfirmed(checkout);
  return (
    <div>
      <ol className="divide-y divide-border border-y-2 border-rule text-sm">
        {checkout.rows.map((r) => {
          const status = checkout.confirmed[r.key] ? "confirmed" : checkout.done[r.key] ? "waiting" : r === next ? "next" : "later";
          return (
            <StepRow
              key={r.key}
              row={r}
              status={status}
              action={status === "next" ? <GiveButton planId={checkout.id} row={r} onGo={onGo} returnPath={checkout.returnPath} /> : undefined}
            />
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-muted" role="status">
        {done
          ? "Every gift is confirmed. Thank you. Each charity's receipt comes from Every.org by email."
          : next
            ? "Each button opens Every.org for that charity and brings you back here. You can stop and come back; this browser remembers where you got to."
            : "All given. Confirmations from Every.org can take a few minutes; this page checks for them."}
      </p>
      <p className="mt-2 text-sm text-muted">
        Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what I promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>. Every gift goes straight to the charity through Every.org; none of it passes through My Offset.
      </p>
    </div>
  );
}

// Pledge (pledge.to): each charity's donation form is embedded on the page, one at a time.

/** The site's accent green (--accent in globals.css, light theme), for the buttons in Pledge's form. */
const ACCENT_HEX = "#1d6b3d";
/** Tall enough for Pledge's form without its own scrolling on most screens; the form scrolls inside past that. */
const PLEDGE_FORM_HEIGHT = 820;

/**
 * A checkout through Pledge: every gift in order, with the next charity's
 * Pledge form open under its row and the amount filled in. When Pledge reports
 * the gift, the row is marked given and the next form opens. Pledge's message
 * can be sent by anyone and names no charity or gift, so a row is never marked
 * confirmed from it: it waits for confirmation, like a gift made on Every.org.
 */
function PledgeSteps({ checkout, onChange, onGo, saved = true, save = saveCheckout }: StepsProps) {
  const [attempt, setAttempt] = useState(0);
  const [short, setShort] = useState<{ key: string; amount: number } | null>(null);
  const partnerKey = pledgePartnerKey();
  const next = nextRow(checkout);
  const ein = next ? PLEDGE_EINS[next.charity] : undefined;
  // Keyed by checkout, row and try, so a fresh form loads for each charity and after a short gift.
  const formKey = next && ein && partnerKey ? `${checkout.id}.${next.key}.${attempt}` : null;
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const latest = useRef({ checkout, onChange, onGo, saved, save, next });
  useEffect(() => {
    latest.current = { checkout, onChange, onGo, saved, save, next };
  });
  // Look once for any gift the server has confirmed. Nothing from Pledge is matched to plans yet (see api/pledge/webhook).
  useEffect(() => {
    if (!saved) return;
    let stopped = false;
    fetchConfirmed(checkout.id).then((paid) => {
      const { checkout: c, onChange: change, save: keep } = latest.current;
      const fresh = paid.filter((k) => !c.confirmed[k] && c.rows.some((r) => r.key === k));
      if (stopped || !fresh.length) return;
      const n = { ...c, confirmed: { ...c.confirmed, ...Object.fromEntries(fresh.map((k) => [k, true as const])) } };
      keep(n);
      change(n);
    });
    return () => {
      stopped = true;
    };
  }, [checkout.id, saved]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const got = pledgeCompleted(e);
      const { checkout: c, onChange: change, onGo: go, saved: kept, save: keep, next: row } = latest.current;
      if (!got || !got.fiat || !row || c.done[row.key]) return;
      // A donor can change the amount in Pledge's form; a smaller gift doesn't count as this charity's share.
      if (got.amount < row.donation - 0.005) {
        setShort({ key: row.key, amount: got.amount });
        setAttempt((a) => a + 1);
        return;
      }
      setShort(null);
      if (!kept) go?.();
      const n = { ...c, done: { ...c.done, [row.key]: new Date().toISOString() } };
      keep(n);
      change(n);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const done = allConfirmed(checkout);
  const shortRow = short && next?.key === short.key ? next : null;
  return (
    <div>
      <ol className="divide-y divide-border border-y-2 border-rule text-sm">
        {checkout.rows.map((r) => {
          const status = checkout.confirmed[r.key] ? "confirmed" : checkout.done[r.key] ? "waiting" : r === next ? "next" : "later";
          return (
            <StepRow key={r.key} row={r} status={status} action={status === "next" ? <span className="figures font-semibold">{usd(r.total)}</span> : undefined}>
              {status === "next" && formKey && (
                <>
                  {shortRow && (
                    <p role="alert" className="mb-2 font-semibold">
                      Pledge reported a gift of <span className="figures">{usd(short?.amount ?? 0)}</span>, less than{" "}
                      {CHARITIES[r.charity].name}&apos;s share of <span className="figures">{usd(r.donation)}</span>. It isn&apos;t marked
                      as given. To give its full share, use the form below.
                    </p>
                  )}
                  <p className="mb-2">
                    {r.donation < PLEDGE_PREFILL_MIN_USD ? (
                      <>
                        Pledge&apos;s form opens at {usd(PLEDGE_PREFILL_MIN_USD)}. Type{" "}
                        <span className="figures font-semibold">{usd(r.donation)}</span> in its Donation box.{" "}
                      </>
                    ) : null}
                    The tip to Pledge is optional; you can set it to $0.
                  </p>
                  <iframe
                    key={formKey}
                    title={`Pledge donation form for ${CHARITIES[r.charity].name}`}
                    src={pledgeFormUrl({
                      partnerKey: partnerKey!,
                      ein: ein!,
                      amount: r.donation,
                      planId: checkout.id,
                      gift: r.key,
                      brandColor: ACCENT_HEX,
                      embeddedOn: origin,
                    })}
                    allow="payment"
                    className="w-full rounded-md border border-border bg-white"
                    style={{ height: PLEDGE_FORM_HEIGHT }}
                  />
                </>
              )}
            </StepRow>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-muted" role="status">
        {done
          ? "Every gift is confirmed. Thank you. Pledge emails each receipt."
          : next
            ? formKey
              ? "Each charity's form is below, one at a time. Pledge emails each receipt. You can stop and come back; this browser remembers where you got to."
              : "Giving through Pledge opens soon."
            : "All given. Thank you. Pledge emails each receipt. Items are marked offset here once I can confirm gifts with Pledge."}
      </p>
      <p className="mt-2 text-sm text-muted">
        Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what I promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>. Every gift goes straight to the charity through Pledge, a nonprofit giving
        platform; none of it passes through My Offset. Pledge may ask for an optional tip, which goes to Pledge. My Offset gets none of it.
      </p>
    </div>
  );
}

/**
 * One charity's Pledge form, opened from "Prefer to give to the charities yourself?" in
 * pledgeapi mode (Ian, 2026-10-24), for people who'd rather give through the form than
 * pay once through Stripe. Such a gift isn't tracked here: it names no plan.
 */
export function DirectPledgeForm({ charity, amount }: { charity: keyof typeof PLEDGE_EINS; amount: number }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  const partnerKey = pledgePartnerKey();
  const ein = PLEDGE_EINS[charity];
  if (!partnerKey || !ein) return null;
  const name = CHARITIES[charity].name;
  return (
    <div className="mt-1 mb-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-sans underline underline-offset-2 hover:text-foreground">
        {open ? "Close Pledge's form" : `Give to ${name} through Pledge's form`}
      </button>
      {open && (
        <div className="mt-2">
          <p className="mb-2 font-sans">
            {amount < PLEDGE_PREFILL_MIN_USD ? (
              <>
                Pledge&apos;s form opens at {usd(PLEDGE_PREFILL_MIN_USD)}. Type <span className="figures font-semibold">{usd(amount)}</span> in its
                Donation box.{" "}
              </>
            ) : null}
            The tip to Pledge is optional; you can set it to $0.
          </p>
          <iframe
            title={`Pledge donation form for ${name}`}
            src={pledgeFormUrl({ partnerKey, ein, amount, planId: "direct", gift: charity, brandColor: ACCENT_HEX, embeddedOn: origin })}
            allow="payment"
            className="w-full rounded-md border border-border bg-white"
            style={{ height: PLEDGE_FORM_HEIGHT }}
          />
        </div>
      )}
    </div>
  );
}

// Pledge's API ("pledgeapi" mode): one Stripe payment for every charity, then the server gives each its part through Pledge.

/**
 * A checkout paid once through Stripe: each charity's part, Stripe's and Pledge's fees, and one Pay
 * button. The server works the amount out again and opens a Stripe Checkout Session; Stripe sends
 * the person back here with paid=stripe, which marks every gift as given. Each is confirmed once
 * Pledge has made it (see api/stripe/webhook), which this page checks for.
 */
function PledgeApiSteps({ checkout, onChange, onGo, saved = true, save = saveCheckout }: StepsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = onePayment(checkout.rows);
  const paid = checkout.rows.length > 0 && checkout.rows.every((r) => checkout.done[r.key] || checkout.confirmed[r.key]);
  const waiting = checkout.rows.some((r) => checkout.done[r.key] && !checkout.confirmed[r.key]);
  const latest = useRef({ checkout, onChange, save });
  useEffect(() => {
    latest.current = { checkout, onChange, save };
  });
  // Back from Stripe, paid: every gift is given, and waits for Pledge's confirmation.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid") !== "stripe" || q.get("plan") !== checkout.id) return;
    const { checkout: c, onChange: change, save: keep } = latest.current;
    const open = c.rows.filter((r) => !c.done[r.key] && !c.confirmed[r.key]);
    if (!open.length) return;
    const at = new Date().toISOString();
    const n = { ...c, done: { ...c.done, ...Object.fromEntries(open.map((r) => [r.key, at])) } };
    keep(n);
    change(n);
  }, [checkout.id]);
  // Look once when the list opens, then keep looking while a gift waits for confirmation.
  useEffect(() => {
    if (!saved) return;
    let polls = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const { checkout: c, onChange: change } = latest.current;
      const got = await fetchConfirmed(c.id);
      if (stopped) return;
      const fresh = got.filter((k) => !c.confirmed[k] && c.rows.some((r) => r.key === k));
      if (fresh.length) {
        const next = { ...c, confirmed: { ...c.confirmed, ...Object.fromEntries(fresh.map((k) => [k, true as const])) } };
        latest.current.save(next);
        change(next);
      } else if (waiting && ++polls < POLLS) timer = setTimeout(check, POLL_MS);
    };
    check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [checkout.id, saved, waiting]);

  const go = async () => {
    setBusy(true);
    setError(null);
    onGo?.();
    const body = checkout.gift
      ? { source: "gift", giftId: checkout.id }
      : { source: "plan", planId: checkout.id, billing: checkout.billing, autopay: false, rows: checkout.rows, ...checkout.plan };
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
      if (!r.ok || typeof d?.url !== "string") throw new Error(typeof d?.error === "string" ? d.error : "Couldn't start the payment.");
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the payment.");
      setBusy(false);
    }
  };

  const done = allConfirmed(checkout);
  return (
    <div>
      <ol className="divide-y divide-border border-y-2 border-rule text-sm">
        {checkout.rows.map((r) => (
          <StepRow key={r.key} row={r} status={checkout.confirmed[r.key] ? "confirmed" : checkout.done[r.key] ? "waiting" : "later"} />
        ))}
      </ol>
      <dl className="figures space-y-1 border-b-2 border-rule py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-sans text-muted">Stripe card fee ({STRIPE_CARD_LABEL})</dt>
          <dd className="shrink-0 text-right">{usd(pay.stripe)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-sans text-muted">
            Pledge fees ({PLEDGE_API_FEE_LABEL} technology, {PLEDGE_API_CARD_LABEL} card)
          </dt>
          <dd className="shrink-0 text-right">{usd(pay.pledge)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold">
          <dt className="font-sans">Total, one payment</dt>
          <dd>{usd(pay.total)}</dd>
        </div>
      </dl>
      {!paid && (
        <div className="mt-3">
          <button
            type="button"
            onClick={go}
            disabled={busy || !checkout.rows.length}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60"
          >
            Pay {usd(pay.total)}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold">
              {error}
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-sm text-muted" role="status">
        {done ? "Every gift is confirmed. Thank you. Pledge emails you a receipt for each gift." : paid ? "Paid. Thank you." : ""}
      </p>
      <p className="mt-2 text-sm text-muted">
        Before you pay: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what I promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>.
      </p>
    </div>
  );
}
