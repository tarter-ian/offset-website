"use client";

import { useEffect, useState } from "react";
import { CheckoutSteps } from "./Checkout";
import { CHARITIES } from "@/lib/charities";
import { savedResults } from "@/lib/extension";
import { allConfirmed, type Checkout, newPlanId, PAYMENT_MODE, paymentsOn, PLAN_ID } from "@/lib/payments";
import { BILLING, usd } from "@/lib/pricing";
import { AI_CHAT_SERVICES, monthlyUse, type MonthUse } from "@/lib/record";
import { type SteadyPlan, steadyDrift } from "@/lib/steady";

// Checks a steady gift against measured use and suggests a top-up or a lower
// gift (Ian, 2026-10-13). Worked out here from the extension's counts; nothing
// about usage is sent to us.

/** Every.org's page for a donor's own gifts, where repeating ones are changed or stopped. */
const EVERY_ACCOUNT = "https://www.every.org/my-giving";

// A top-up in progress, kept apart from the plan's own checkout so the steady gift's record stays.
const TOPUP_KEY = "offset:topup:v1";
interface TopUp {
  checkout: Checkout;
  /** The last month this top-up pays for. */
  through: string;
}

function loadTopUp(): TopUp | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOPUP_KEY) ?? "null") as TopUp | null;
    const c = t?.checkout;
    return c && PLAN_ID.test(c.id) && Array.isArray(c.rows) && typeof t.through === "string"
      ? { through: t.through, checkout: { ...c, done: c.done ?? {}, confirmed: c.confirmed ?? {} } }
      : null;
  } catch {
    return null;
  }
}

function saveTopUp(t: TopUp | null) {
  try {
    if (t) localStorage.setItem(TOPUP_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOPUP_KEY);
  } catch {
    // Storage blocked: progress lasts only while the page is open.
  }
}

const monthLong = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const prompts = (n: number) => (n >= 10 ? Math.round(n) : n).toLocaleString();

/** Shows nothing unless payments are on, the plan repeats through Every.org, and there are counts to compare with. */
export function SteadyCheck({ plan, use: given, inStore = false }: { plan: SteadyPlan | null; use?: MonthUse[] | null; inStore?: boolean }) {
  const [topUp, setTopUp] = useState<TopUp | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<MonthUse[] | null>(null);
  const use = given === undefined ? loaded : given;
  const on = paymentsOn() && PAYMENT_MODE === "every" && !!plan;

  useEffect(() => {
    setDraftId(newPlanId());
    // Coming back from Every.org: mark that charity's top-up as given.
    const saved = loadTopUp();
    const q = new URLSearchParams(window.location.search);
    if (saved && saved.checkout.id === q.get("plan")) {
      const row = saved.checkout.rows.find((r) => r.key === q.get("charity"));
      const c = row && !saved.checkout.done[row.key] ? { ...saved.checkout, done: { ...saved.checkout.done, [row.key]: new Date().toISOString() } } : saved.checkout;
      const t = { ...saved, checkout: c };
      saveTopUp(t);
      setTopUp(t);
    } else setTopUp(saved);
  }, []);
  useEffect(() => {
    if (on && given === undefined) savedResults().then((r) => setLoaded(monthlyUse(Object.fromEntries(AI_CHAT_SERVICES.map((s) => [s, r[s]?.record])))));
  }, [on, given]);

  if (!on || !plan || !use?.length) return null;
  const pending = topUp && !allConfirmed(topUp.checkout) ? topUp : null;
  const d = steadyDrift(plan, use, { toppedThrough: topUp && !pending ? topUp.through : undefined });
  if (!d && !pending) return null;
  const per = BILLING[plan.billing].per;
  const draft: Checkout | null =
    d && d.topUp.length && draftId
      ? { id: draftId, created: new Date().toISOString(), billing: plan.billing, rows: d.topUp, lines: [], done: {}, confirmed: {}, returnPath: "/record" }
      : null;
  const everyNote = (
    <>
      Every.org runs repeating gifts, so they change in{" "}
      <a href={EVERY_ACCOUNT} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-muted">
        your Every.org account
      </a>
      , not here.
    </>
  );

  // On the store it sits under the checkout's own heading.
  const Heading = inStore ? "h4" : "h2";
  const Sub = inStore ? "h5" : "h3";
  return (
    <section aria-labelledby="steady-heading" className={inStore ? "mt-6 border-t-2 border-rule pt-3" : "mt-12"}>
      <Heading id="steady-heading" className={inStore ? "text-base font-bold" : "text-2xl font-bold"}>
        Your steady gift and your real use
      </Heading>
      {d && (
        <>
          <p className="mt-2 max-w-2xl">
            Your AI use ran {d.kind === "above" ? "higher" : "lower"} than your steady gift was set for: about{" "}
            <b className="amount">{prompts(d.measured)} prompts a day</b> in {list(d.months.map(monthLong))}, against {prompts(d.setFor)}.
          </p>
          <dl className="mt-3 max-w-2xl border-t-2 border-rule text-sm">
            {d.changes.map((c) => (
              <div key={c.charity} className="flex flex-wrap justify-between gap-x-4 border-b border-border py-2">
                <dt className="font-sans">{CHARITIES[c.charity].name}</dt>
                <dd>
                  <span className="figures">{usd(c.from)}</span> {per} now, <span className="figures">{usd(c.to)}</span> at your real use
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 max-w-2xl text-sm">
            {d.kind === "above" ? "To keep up from here, raise each gift above." : "You could lower each gift above."} {everyNote}
          </p>
        </>
      )}
      {pending ? (
        <div className="mt-6 max-w-2xl">
          <Sub className="text-base font-bold">Your top-up</Sub>
          <div className="mt-2">
            <CheckoutSteps checkout={pending.checkout} save={(c) => saveTopUp({ ...pending, checkout: c })} onChange={(c) => setTopUp({ ...pending, checkout: c })} />
          </div>
        </div>
      ) : (
        draft && (
          <div className="mt-6 max-w-2xl">
            <Sub className="text-base font-bold">Offset {list(d!.topUpMonths.map(monthLong))} in full</Sub>
            <p className="mt-1 text-sm text-muted">A one-time gift for the gap between what you used and what your steady gift gave.</p>
            <div className="mt-2">
              <CheckoutSteps
                checkout={draft}
                saved={false}
                save={(c) => saveTopUp({ checkout: c, through: d!.topUpMonths.at(-1)! })}
                onChange={(c) => setTopUp({ checkout: c, through: d!.topUpMonths.at(-1)! })}
                onGo={() => {
                  const t = { checkout: draft, through: d!.topUpMonths.at(-1)! };
                  saveTopUp(t);
                  setTopUp(t);
                }}
              />
            </div>
          </div>
        )
      )}
      <p className="mt-3 max-w-2xl text-sm text-muted">Worked out on this computer from your counts. We never see them.</p>
    </section>
  );
}
