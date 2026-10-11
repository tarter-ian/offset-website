"use client";

import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";
import { CHARITIES } from "@/lib/charities";
import { CONFIDENCE_LABELS, MARGINS, type Answers, type Footprint } from "@/lib/footprint";
import { DONATION_PER_TONNE_USD, monthlyCost, usd } from "@/lib/pricing";

const fmtKg = (kg: number) => `${Math.round(kg).toLocaleString("en-US")} kg`;
const fmtTonnes = (kg: number) => (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 });

// What a linked account would replace, for the "sharpen your estimate" hint.
const LINK_HINTS: Record<string, string> = {
  electricity: "your utility account",
  heating: "your gas or fuel account",
  car: "your car",
  flights: "your bank card",
  food: "your bank card",
  shopping: "your bank card",
};

export function Results({ footprint, answers, onEdit }: { footprint: Footprint; answers: Answers; onEdit: () => void }) {
  const cost = monthlyCost(footprint.offsetKg);
  const largest = Math.max(...footprint.categories.map((c) => c.offsetKg), 1);
  const linkSaving = (c: Footprint["categories"][number]) => c.kg * Math.max(0, c.margin - MARGINS.measured);
  const biggestMargin = [...footprint.categories]
    .filter((c) => LINK_HINTS[c.key] && linkSaving(c) > 0)
    .sort((a, b) => linkSaving(b) - linkSaving(a))[0];
  const who = answers.scope === "household" ? "Your household's" : "Your";

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{who} estimated footprint</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight">
          {fmtTonnes(footprint.totalKg)} tonnes CO₂e a month
        </h2>
        <p className="mt-2 text-muted">
          About {fmtTonnes(footprint.totalKg * 12)} tonnes a year. To make sure it&apos;s fully covered, we offset{" "}
          {fmtTonnes(footprint.offsetKg)} tonnes a month, which includes a margin for uncertainty.
        </p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Estimate a month</th>
              <th className="px-4 py-3 font-medium">Source and margin</th>
              <th className="px-4 py-3 text-right font-medium">Offset</th>
            </tr>
          </thead>
          <tbody>
            {footprint.categories.map((c) => (
              <tr key={c.key} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.label}</div>
                  {c.note && <div className="text-muted">{c.note}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="whitespace-nowrap">{fmtKg(c.kg)}</div>
                  <div className="mt-1 h-1.5 w-32 rounded-full bg-accent-soft">
                    <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(c.offsetKg / largest) * 100}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.kg > 0 ? `${CONFIDENCE_LABELS[c.confidence]}, +${Math.round(c.margin * 100)}%` : "None"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{fmtKg(c.offsetKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Your monthly offset</h3>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted">
                Donation ({fmtTonnes(footprint.offsetKg)} t at {usd(DONATION_PER_TONNE_USD)} a tonne)
              </dt>
              <dd>{usd(cost.donation)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Service fee</dt>
              <dd>{usd(cost.fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{usd(cost.total)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            You&apos;ll review and approve this each month. Nothing is charged automatically.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Where your donation goes</h3>
          <ul className="mt-4 space-y-3">
            {CHARITIES.map((ch) => (
              <li key={ch.name} className="flex justify-between gap-4">
                <div>
                  <a href={ch.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                    {ch.name}
                  </a>
                  <div className="text-sm text-muted">{ch.focus}</div>
                </div>
                <div className="shrink-0">{usd(cost.donation * ch.share)}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">Example charities. The final list is being vetted.</p>
        </div>
      </section>

      <section className="flex flex-col gap-6 rounded-xl bg-accent-soft p-6 sm:flex-row sm:items-center">
        <div
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-accent bg-card text-center text-accent"
          aria-hidden
        >
          <span className="text-xs font-semibold uppercase leading-tight">Fully</span>
          <span className="text-xs font-semibold uppercase leading-tight">Offset</span>
        </div>
        <div>
          <h3 className="font-semibold">Earn your Fully Offset badge</h3>
          <p className="mt-1 text-muted">
            Each month you approve earns the badge and adds to your streak. You can share it or join our public list.
            The badge links to <Link href="/method" className="text-accent hover:underline">how we calculate</Link>.
          </p>
          {biggestMargin && (
            <p className="mt-3 text-sm">
              Linking {LINK_HINTS[biggestMargin.key]} will shrink your margin the most, by about{" "}
              {fmtKg(linkSaving(biggestMargin))} of offset a month.
            </p>
          )}
        </div>
      </section>

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
