"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutSteps } from "./Checkout";
import { CHARITIES } from "@/lib/charities";
import { allConfirmed, type Checkout, loadCheckout, nextRow, saveCheckout } from "@/lib/payments";

/**
 * Where Every.org sends the person after a gift. Marks that gift done, shows the
 * whole list, and offers the next charity's button. It never opens the next one
 * by itself: browsers block pop-ups, and the person should choose to go on.
 */
export function ReturnFromEvery() {
  const [state, setState] = useState<{ checkout: Checkout | null; gave: string | null } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const plan = q.get("plan");
    const gave = q.get("charity");
    const saved = loadCheckout();
    if (!saved || saved.id !== plan) {
      setState({ checkout: null, gave });
      return;
    }
    const row = saved.rows.find((r) => r.key === gave);
    const checkout = row && !saved.done[row.key] ? { ...saved, done: { ...saved.done, [row.key]: new Date().toISOString() } } : saved;
    saveCheckout(checkout);
    setState({ checkout, gave: row ? row.key : null });
  }, []);

  if (!state) return <p className="text-muted">Loading your gifts…</p>;
  const { checkout, gave } = state;
  if (!checkout) {
    return (
      <div className="border-t-4 border-rule pt-4">
        <h1 className="text-3xl font-extrabold [font-stretch:85%]">Thank you</h1>
        <p className="mt-3">
          We couldn&apos;t find this list of gifts in this browser, so we can&apos;t show what&apos;s left. Any gift you made went to the
          charity, and Every.org has emailed you its receipt.
        </p>
        <p className="mt-4">
          <Link href="/" className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
            Back to your plan
          </Link>
        </p>
      </div>
    );
  }
  const gaveRow = checkout.rows.find((r) => r.key === gave);
  const next = nextRow(checkout);
  const given = checkout.rows.filter((r) => checkout.done[r.key] || checkout.confirmed[r.key]).length;
  return (
    <div className="border-t-4 border-rule pt-4">
      <h1 className="text-3xl font-extrabold [font-stretch:85%]">
        {allConfirmed(checkout) ? "All your gifts are in" : gaveRow ? `Thank you for giving to ${CHARITIES[gaveRow.charity].name}` : "Your gifts"}
      </h1>
      <p className="mt-3 text-muted">
        {next
          ? `${given} of ${checkout.rows.length} given. Next is ${CHARITIES[next.charity].name}.`
          : "Every charity on your list has been given to."}
      </p>
      <div className="mt-6">
        <CheckoutSteps checkout={checkout} onChange={(c) => setState({ checkout: c, gave })} />
      </div>
      <p className="mt-6">
        <Link href="/" className="cursor-pointer font-semibold underline underline-offset-4 hover:text-muted">
          Back to your plan
        </Link>
      </p>
    </div>
  );
}
