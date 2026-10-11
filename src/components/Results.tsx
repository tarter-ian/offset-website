"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "./Badge";
import { WaitlistForm } from "./WaitlistForm";
import { CHARITIES } from "@/lib/charities";
import {
  AREAS,
  CATEGORY_KEYS,
  CONFIDENCE_LABELS,
  IMPACT_KEYS,
  sumImpacts,
  type Answers,
  type CategoryKey,
  type CategoryResult,
  type Footprint,
  type ImpactKey,
} from "@/lib/footprint";
import { IMPACT_INFO } from "@/lib/impacts";
import {
  FEE_PER_AREA_USD,
  impactCost,
  LIFETIME_GROWTH_BUFFER,
  LIFETIME_YEARS,
  lifetimeCost,
  MAX_FEE_USD,
  MIN_DONATION_USD,
  monthlyCost,
  usd,
} from "@/lib/pricing";

// The single change that would shrink each category most.
const TIPS: Record<CategoryKey, string> = {
  electricity: "Switch to a renewable plan from your utility, or add rooftop solar.",
  heating: "A heat pump cuts heating emissions and indoor air pollution.",
  car: "Combine trips, or make your next car electric.",
  flights: "Take one fewer long flight a year, or the train for short trips.",
  transit: "You're already doing well here. Keep choosing the bus and train.",
  meat: "Swapping beef for chicken or beans cuts carbon, water and land use.",
  dairy: "Try plant milks, which use a fraction of the land and water.",
  plants: "Waste less: plan meals and freeze leftovers.",
  clothing: "Buy fewer, longer-lasting clothes, and secondhand where you can.",
  electronics: "Keep phones and laptops a year or two longer.",
  household: "Buy secondhand furniture and repair before replacing.",
  services: "Choose local and low-carbon services where you have the option.",
  ai: "Use a smaller, faster model for simple questions.",
  streaming: "Watch in standard definition on small screens.",
};

const PRESETS: { label: string; keys: CategoryKey[] }[] = [
  { label: "Everything", keys: CATEGORY_KEYS },
  { label: "Just my home", keys: ["electricity", "heating"] },
  { label: "Just travel", keys: ["car", "flights", "transit"] },
  { label: "Just AI", keys: ["ai"] },
];

const costOf = (c: CategoryResult, impacts: ImpactKey[]) => {
  const i = impactCost(c.offset);
  return impacts.reduce((s, k) => s + i[k], 0);
};

/** A checkbox that can show "some selected". */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 accent-[var(--accent)]"
    />
  );
}

export function Results({
  footprint,
  answers,
  onEdit,
  show = CATEGORY_KEYS,
  initialCovered = CATEGORY_KEYS,
}: {
  footprint: Footprint;
  answers: Answers;
  onEdit: () => void;
  /** Categories to list. The AI-only page shows just one. */
  show?: CategoryKey[];
  initialCovered?: CategoryKey[];
}) {
  const [covered, setCovered] = useState<CategoryKey[]>(initialCovered);
  const [impacts, setImpacts] = useState<ImpactKey[]>(IMPACT_KEYS);
  const rows = footprint.categories.filter((c) => show.includes(c.key));
  const cost = monthlyCost(footprint, covered, impacts);
  const lifetime = lifetimeCost(cost);
  const rawDonation = cost.byImpact.carbon + cost.byImpact.air + cost.byImpact.water + cost.byImpact.land;
  const allImpacts = IMPACT_KEYS.every((k) => impacts.includes(k));
  const everything = allImpacts && CATEGORY_KEYS.every((k) => covered.includes(k));
  const who = answers.scope === "household" ? "Your household's" : "Your";
  const totals = sumImpacts(rows.map((c) => c.impacts));
  const single = show.length === 1;
  const active = covered.length > 0 && impacts.length > 0;
  const topTwo = rows
    .filter((c) => covered.includes(c.key))
    .sort((a, b) => costOf(b, IMPACT_KEYS) - costOf(a, IMPACT_KEYS))
    .slice(0, 2);

  const toggle = (k: CategoryKey) =>
    setCovered((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const toggleArea = (keys: CategoryKey[]) =>
    setCovered((cur) =>
      keys.every((k) => cur.includes(k)) ? cur.filter((k) => !keys.includes(k)) : [...new Set([...cur, ...keys])],
    );
  const toggleImpact = (k: ImpactKey) =>
    setImpacts((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : IMPACT_KEYS.filter((x) => x === k || cur.includes(x))));

  const groups = AREAS.map((a) => ({ ...a, rows: rows.filter((c) => a.categories.includes(c.key)) })).filter(
    (g) => g.rows.length > 0,
  );
  const fullAreas = groups.filter((g) => g.rows.every((c) => covered.includes(c.key)));
  const partialBadges = groups.flatMap((g) =>
    fullAreas.includes(g) ? [] : g.rows.filter((c) => covered.includes(c.key)).map((c) => c.label),
  );
  const impactLabel = allImpacts ? undefined : impacts.map((k) => IMPACT_INFO[k].label).join(", ");

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{who} estimated footprint each month</p>
        <div className={`mt-4 grid grid-cols-2 gap-3 ${single ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          {IMPACT_KEYS.filter((k) => !single || totals[k] > 0).map((k) => (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm text-muted">{IMPACT_INFO[k].label}</div>
              <div className="mt-1 text-lg font-semibold">{IMPACT_INFO[k].format(totals[k])}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Air pollution is the estimated cost to people&apos;s health.
          {totals.land > 0 && " Nature is the land used to grow your food."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">What to offset</h2>
        <p className="mt-1 text-muted">Each kind of harm goes to a different type of charity. Cover any of them.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Kinds of harm to offset">
          {IMPACT_KEYS.filter((k) => !single || totals[k] > 0).map((k) => {
            const on = impacts.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleImpact(k)}
                className={`rounded-lg border px-4 py-3 text-left ${
                  on ? "border-accent bg-accent-soft" : "border-border bg-card hover:border-accent"
                }`}
              >
                <span className="block font-medium">
                  {on ? "✓ " : ""}
                  {IMPACT_INFO[k].label}
                </span>
                <span className="block text-sm text-muted">{CHARITIES[k].name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{single ? "The details" : "Which parts of your life"}</h2>
            {!single && <p className="mt-1 text-muted">Cover everything, a whole area, or single items.</p>}
          </div>
          {!single && (
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setCovered(p.keys)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:border-accent"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="w-10 px-4 py-3 font-medium">
                  <span className="sr-only">Cover</span>
                </th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">This month</th>
                <th className="px-4 py-3 font-medium">Source and margin</th>
                <th className="px-4 py-3 text-right font-medium">To cover</th>
              </tr>
            </thead>
            {groups.map((g) => {
              const keys = g.rows.map((c) => c.key);
              const n = keys.filter((k) => covered.includes(k)).length;
              const areaCost = g.rows.reduce((s, c) => s + costOf(c, impacts), 0);
              return (
                <tbody key={g.key} className="border-b border-border last:border-0">
                  {!single && (
                    <tr className="bg-accent-soft/50">
                      <td className="px-4 py-2">
                        <TriCheckbox
                          checked={n === keys.length}
                          indeterminate={n > 0 && n < keys.length}
                          onChange={() => toggleArea(keys)}
                          label={`Cover all of ${g.label}`}
                        />
                      </td>
                      <td className="px-4 py-2 font-semibold" colSpan={3}>
                        {g.label}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">{usd(areaCost)}</td>
                    </tr>
                  )}
                  {g.rows.map((c) => {
                    const on = covered.includes(c.key);
                    const counted = IMPACT_KEYS.filter((k) => c.impacts[k] > 0);
                    return (
                      <tr key={c.key} className={`align-top ${on ? "" : "opacity-60"}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(c.key)}
                            aria-label={`Cover ${c.label}`}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.label}</div>
                          {c.note && <div className="text-muted">{c.note}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {counted.length ? (
                            <ul className="space-y-0.5">
                              {counted.map((k) => (
                                <li
                                  key={k}
                                  className={`whitespace-nowrap ${impacts.includes(k) ? "" : "text-muted line-through"}`}
                                >
                                  {IMPACT_INFO[k].format(c.impacts[k])}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                          {c.notCounted.length > 0 && (
                            <div className="mt-1 text-xs text-muted">
                              Not counted yet: {c.notCounted.map((k) => IMPACT_INFO[k].label.toLowerCase()).join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {counted.length ? `${CONFIDENCE_LABELS[c.confidence]}, +${Math.round(c.margin * 100)}%` : ""}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{usd(costOf(c, impacts))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Your monthly offset</h3>
          {!active ? (
            <p className="mt-4 text-muted">Pick at least one item and one kind of harm to cover.</p>
          ) : (
            <>
              <dl className="mt-4 space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Donation to charities</dt>
                  <dd>{usd(cost.donation)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    Our fee ({usd(FEE_PER_AREA_USD)} an area, up to {usd(MAX_FEE_USD)})
                  </dt>
                  <dd>{usd(cost.fee)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd>{usd(cost.total)}</dd>
                </div>
              </dl>
              {cost.minimumApplied && (
                <p className="mt-3 text-sm text-muted">
                  Covering this costs {usd(rawDonation)}, so we round the donation up to {usd(MIN_DONATION_USD)}. All of
                  it goes to the charities.
                </p>
              )}
              <p className="mt-4 text-sm text-muted">
                You&apos;ll review and approve this each month. Nothing is charged automatically.
              </p>
              {lifetime && (
                <div className="mt-5 rounded-lg bg-accent-soft p-4">
                  <p className="font-semibold">Or cover it for life: {usd(lifetime.total)} once</p>
                  <p className="mt-1 text-sm text-muted">
                    A {usd(lifetime.donation)} donation plus a {usd(lifetime.fee)} fee covers {LIFETIME_YEARS} years of
                    today&apos;s use, {LIFETIME_GROWTH_BUFFER} times over in case it grows. Your badges stay on for
                    life. Once a year we&apos;ll check your use and only ask again if it passes what you covered.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Where your donation goes</h3>
          {active ? (
            <ul className="mt-4 space-y-3">
              {impacts
                .filter((k) => cost.byImpact[k] > 0)
                .map((k) => {
                  const ch = CHARITIES[k];
                  const share = rawDonation > 0 ? (cost.byImpact[k] / rawDonation) * cost.donation : 0;
                  return (
                    <li key={k} className="flex justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted">{IMPACT_INFO[k].label}</div>
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-accent hover:underline"
                        >
                          {ch.name}
                        </a>
                        <div className="text-sm text-muted">{ch.focus}</div>
                      </div>
                      <div className="shrink-0">{usd(share)}</div>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="mt-4 text-muted">Nothing selected yet.</p>
          )}
          <p className="mt-4 text-sm text-muted">
            Example charities; the final list is being vetted. You&apos;ll get a receipt from our donation partner.
          </p>
        </div>
      </section>

      {active && (
        <section className="rounded-xl bg-accent-soft p-6">
          <h3 className="font-semibold">Badges you&apos;d earn each month</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {everything && <Badge />}
            {!everything &&
              fullAreas.map((g) => <Badge key={g.key} area={single ? g.rows[0].label : g.label} detail={impactLabel} size="sm" />)}
            {everything && fullAreas.map((g) => <Badge key={g.key} area={g.label} size="sm" />)}
            {partialBadges.map((label) => (
              <Badge key={label} area={label} detail={impactLabel} size="sm" />
            ))}
          </div>
          <p className="mt-4 text-muted">
            You earn a badge for each item or whole area you cover.{" "}
            {everything
              ? "Covering everything, for all four kinds of harm, earns the complete Fully Offset badge."
              : "Cover everything for all four kinds of harm to earn the complete Fully Offset badge."}{" "}
            Badges count approved months and build a streak you can share. Each links to{" "}
            <Link href="/method" className="text-accent hover:underline">
              how we calculate
            </Link>
            .
          </p>
        </section>
      )}

      {topTwo.length > 0 && (
        <section>
          <h3 className="font-semibold">Biggest ways to cut your footprint</h3>
          <p className="mt-1 text-muted">Donations fund this work alongside these changes, not instead of them.</p>
          <ul className="mt-3 space-y-2">
            {topTwo.map((c) => (
              <li key={c.key} className="rounded-lg border border-border bg-card px-4 py-3">
                <span className="font-medium">{c.label}:</span> {TIPS[c.key]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Accounts open soon</h3>
        <p className="mb-4 mt-1 text-muted">Join the waitlist to link your accounts and start offsetting.</p>
        <WaitlistForm />
      </section>

      <button type="button" onClick={onEdit} className="font-medium text-accent hover:text-accent-strong">
        ← Change my answers
      </button>
    </div>
  );
}
