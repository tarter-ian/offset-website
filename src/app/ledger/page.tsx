import type { Metadata } from "next";
import Link from "next/link";
import { CARBON_REMOVAL, CHARITIES } from "@/lib/charities";
import { IMPACT_KEYS } from "@/lib/footprint";
import { IMPACT_INFO } from "@/lib/impacts";
import { LEDGER } from "@/lib/ledger";
import { usd } from "@/lib/pricing";

export const metadata: Metadata = { title: "Where the money goes | Offset" };

const STEPS = [
  { title: "You pay", body: "Your donation and the card fee are listed separately at checkout." },
  { title: "Our donation partner", body: "Your donation goes straight to a registered donation platform, which sends you the tax receipt. We never hold it." },
  { title: "The charities", body: "The partner pools small donations and pays each charity on your summary once a month. The card fee goes to the card processor; we keep nothing." },
];

export default function LedgerPage() {
  const causes = [
    ...IMPACT_KEYS.map((k) => ({ key: k as string, label: IMPACT_INFO[k].label, charity: CHARITIES[k] })),
    { key: "removal", label: "Carbon removal", charity: CARBON_REMOVAL },
  ];
  const given = (cause: string) => LEDGER.filter((e) => e.cause === cause).reduce((sum, e) => sum + e.usd, 0);
  const total = LEDGER.reduce((sum, e) => sum + e.usd, 0);
  const months = [...new Set(LEDGER.map((e) => e.month))].sort().reverse();

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Where the money goes</h1>
      <p className="mt-4 text-lg text-muted">
        Every dollar given through this site, to every charity, with the receipt. Updated each month.
      </p>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-rule pt-3">
            <p className="font-mono text-sm text-muted">{i + 1}</p>
            <p className="font-display text-lg font-bold">{s.title}</p>
            <p className="mt-1">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-xl font-semibold">Given so far</h2>
      <table className="mt-3 w-full border-t-2 border-rule text-left">
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <th className="py-2 font-medium">For</th>
            <th className="py-2 font-medium">Charity</th>
            <th className="py-2 text-right font-medium">Given</th>
          </tr>
        </thead>
        <tbody>
          {causes.map((c) => (
            <tr key={c.key} className="border-b border-border align-top">
              <td className="py-3 pr-4">{c.label}</td>
              <td className="py-3 pr-4">
                <a href={c.charity.url} target="_blank" rel="noreferrer" className="underline hover:text-muted">
                  {c.charity.name}
                </a>
                <span className="block text-sm text-muted">{c.charity.focus}</span>
              </td>
              <td className="py-3 text-right font-mono">{usd(given(c.key))}</td>
            </tr>
          ))}
          <tr className="border-b-2 border-rule font-semibold">
            <td className="py-3" colSpan={2}>
              Total
            </td>
            <td className="py-3 text-right font-mono">{usd(total)}</td>
          </tr>
        </tbody>
      </table>

      {months.length === 0 ? (
        <p className="mt-4 text-muted">
          Nothing yet: donations open at launch, and the first month&apos;s receipts go up here the month after. The charities above are
          examples while we choose our donation partner and finish vetting the list.
        </p>
      ) : (
        <>
          <h2 className="mt-12 text-xl font-semibold">Receipts by month</h2>
          {months.map((m) => (
            <div key={m} className="mt-4">
              <p className="font-display font-bold">{m}</p>
              <ul className="mt-1 space-y-1">
                {LEDGER.filter((e) => e.month === m).map((e) => (
                  <li key={`${e.month}-${e.charity}`} className="flex justify-between gap-4 border-b border-border py-1">
                    <a href={e.receipt} target="_blank" rel="noreferrer" className="underline hover:text-muted">
                      {e.charity}
                    </a>
                    <span className="font-mono">{usd(e.usd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <p className="mt-10 text-muted">
        See <Link href="/promises" className="text-accent hover:underline">our promises</Link> and{" "}
        <Link href="/method" className="text-accent hover:underline">how we calculate</Link>.
      </p>
    </article>
  );
}
