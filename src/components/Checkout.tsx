"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHARITIES } from "@/lib/charities";
import { IMPACT_INFO } from "@/lib/impacts";
import {
  allConfirmed,
  type Checkout,
  fetchConfirmed,
  frequencyText,
  FUND_KEY,
  fundLink,
  harmsText,
  nextRow,
  payLink,
  type PayRow,
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
function StepRow({ row, status, action }: { row: PayRow; status: "next" | "later" | "waiting" | "confirmed"; action?: React.ReactNode }) {
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
            {usd(row.donation)} + {usd(row.fee)} card fee
          </span>
          {row.frequency !== "ONCE" && `, ${frequencyText(row)} until you stop it`}
        </span>
        {status === "waiting" && <span className="block pl-6 text-muted">Given, waiting for confirmation</span>}
        {status === "confirmed" && <span className="block pl-6 font-semibold text-life-ink">Given and confirmed by Every.org</span>}
      </span>
      {action ?? (status === "later" && <span className="figures text-muted">{usd(row.total)}</span>)}
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
          <span className="block text-muted">Endaoment emails your tax receipt. The gift link works once we can confirm the gift with Endaoment.</span>
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
        Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what we promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>. None of it passes through My Offset.
      </p>
    </div>
  );
}

/**
 * A checkout in progress: every gift in order, with a Give button on the next
 * one only. Checks with the server which gifts Every.org has confirmed, and keeps
 * checking for a while after the person comes back.
 */
export function CheckoutSteps({
  checkout,
  onChange,
  onGo,
  saved = true,
  save = saveCheckout,
}: {
  checkout: Checkout;
  onChange: (c: Checkout) => void;
  /** Where progress is kept: the plan's checkout by default, or a gift's. */
  save?: (c: Checkout) => void;
  /** Called as the person taps Give, before Every.org opens. */
  onGo?: () => void;
  /** False for a list not yet started, which has nothing to look up. */
  saved?: boolean;
}) {
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
        Before you give: <Link href="/ledger">where the money goes</Link>, <Link href="/promises">what we promise</Link> and{" "}
        <Link href="/method">how each price is worked out</Link>. Every gift goes straight to the charity through Every.org; none of it passes through My Offset.
      </p>
    </div>
  );
}
