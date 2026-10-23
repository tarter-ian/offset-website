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
  payLink,
  PAYMENT_MODE,
  type PayRow,
  PLEDGE_EINS,
  PLEDGE_ORIGIN,
  pledgeCompleted,
  pledgePartnerKey,
  saveCheckout,
} from "@/lib/payments";
import { ENDAOMENT_GRANT_LABEL, ENDAOMENT_IN_LABEL, usd } from "@/lib/pricing";

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
            {row.fee > 0 ? `${usd(row.donation)} + ${usd(row.fee)} card fee` : `${usd(row.donation)}, no card fee`}
          </span>
          {row.frequency !== "ONCE" && `, ${frequencyText(row)} until you stop it`}
        </span>
        {status === "waiting" && <span className="block pl-6 text-muted">Given, waiting for confirmation</span>}
        {status === "confirmed" && (
          <span className="block pl-6 font-semibold text-life-ink">
            {forMode({ every: "Given and confirmed by Every.org", pledge: "Given and confirmed by Pledge", endaoment: "Given and confirmed", sponsor: "Given and confirmed" })}
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

/** A checkout in progress, one gift per charity: Every.org's Give buttons, or Pledge's forms in pledge mode. */
export function CheckoutSteps(props: StepsProps) {
  return PAYMENT_MODE === "pledge" ? <PledgeSteps {...props} /> : <EverySteps {...props} />;
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

const PLEDGE_SCRIPT = `${PLEDGE_ORIGIN}/embed/widget.js`;
/** The site's accent green (--accent in globals.css, light theme), for the buttons in Pledge's form. */
const ACCENT_HEX = "#1d6b3d";

/**
 * Loads Pledge's widget.js, which turns each .plg-donate div into a form. It
 * scans the page when it runs, and its docs name no way to scan again, so each
 * time a new form div mounts this removes the script tag and adds it back, which
 * runs it again over the new div. Unverified against the live widget: if it
 * guards against running twice, the second charity's form won't appear.
 */
function usePledgeWidget(formKey: string | null) {
  useEffect(() => {
    if (!formKey) return;
    document.getElementById("pledge-widget-js")?.remove();
    const s = document.createElement("script");
    s.id = "pledge-widget-js";
    s.src = PLEDGE_SCRIPT;
    s.async = true;
    document.body.appendChild(s);
  }, [formKey]);
}

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
  // Keyed by checkout, row and try, so a new div mounts for each form and the widget runs over it.
  const formKey = next && ein && partnerKey ? `${checkout.id}.${next.key}.${attempt}` : null;
  usePledgeWidget(formKey);
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
                  <div
                    key={formKey}
                    className="plg-donate"
                    data-partner-key={partnerKey ?? ""}
                    data-ein={ein}
                    data-amount={r.donation.toFixed(2)}
                    data-currency="usd"
                    // Pledge's widget.js passes tipRate on to the form; 0 starts its optional tip at nothing.
                    data-tip-rate="0"
                    // widget.js sends any data-x-* attributes to Pledge as the gift's metadata, so the
                    // webhook can name the plan and the charity's gift once its payload is known.
                    data-x-plan={checkout.id}
                    data-x-gift={r.key}
                    data-style-hide-social="true"
                    data-style-brand-color={ACCENT_HEX}
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
              ? "Each charity's form is below, one at a time, with its amount filled in. Pledge emails each receipt. You can stop and come back; this browser remembers where you got to."
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
