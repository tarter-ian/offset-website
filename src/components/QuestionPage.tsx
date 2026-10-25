import Link from "next/link";
import { MINUTES_OF_LIFE_PER_DAMAGE_USD } from "@/lib/factors";
import { lifeText } from "@/lib/impacts";
import { QUESTIONS, type Question } from "@/lib/questions";

// The layout every question page shares: the question, the answer first, the
// numbers as an itemized receipt, how we got them, and what covering it costs.

export type Row = [label: string, value: string];

/** Grams under a kilogram, kilograms above. */
export const mass = (kg: number) =>
  kg < 1 ? `${kg < 0.01 ? (kg * 1000).toFixed(2) : Math.round(kg * 1000)} g` : `${kg < 10 ? kg.toFixed(1) : Math.round(kg).toLocaleString("en-US")} kg`;
/** Milliliters under a liter, liters above. */
export const volume = (l: number) => (l < 1 ? `${(l * 1000).toFixed(l < 0.01 ? 2 : 1)} mL` : `${l < 10 ? l.toFixed(1) : Math.round(l).toLocaleString("en-US")} L`);
/** Watt-hours, or kilowatt-hours from 1,000. */
export const energy = (wh: number) => (wh < 1000 ? `${wh < 10 ? Number(wh.toFixed(2)) : Math.round(wh)} Wh` : `${(wh / 1000).toFixed(1)} kWh`);

/** Healthy life lost to air pollution damage (dollars), with tenths of a second when it's small. */
export const life = (usdDamage: number) => {
  const sec = usdDamage * MINUTES_OF_LIFE_PER_DAMAGE_USD * 60;
  return sec < 60 ? `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} sec` : lifeText(usdDamage);
};

export const link = "underline underline-offset-2 hover:text-foreground";

export function Receipt({ title, rows, total }: { title: string; rows: Row[]; total?: Row }) {
  return (
    <section className="border-t-4 border-rule pt-3">
      <h2 className="font-semibold">{title}</h2>
      <dl className="figures mt-2 divide-y divide-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="font-sans text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
        {total && (
          <div className="flex justify-between gap-4 border-t-2 border-rule py-2 font-semibold">
            <dt className="font-sans">{total[0]}</dt>
            <dd className="text-right">{total[1]}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function QuestionPage({
  q,
  answer,
  receipts,
  how,
  cover,
}: {
  q: Question;
  answer: React.ReactNode;
  receipts: React.ReactNode;
  how: React.ReactNode;
  cover: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted">
        <Link href="/questions" className={link}>
          Questions
        </Link>
      </p>
      <h1 className="mt-2 text-4xl font-extrabold [font-stretch:85%]">{q.question}</h1>
      <div className="mt-4 text-lg">{answer}</div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">{receipts}</div>

      <h2 className="mt-10 text-xl font-semibold">How I got this</h2>
      <div className="mt-2 space-y-3 text-muted">{how}</div>

      <h2 className="mt-10 text-xl font-semibold">What it costs to cover</h2>
      <div className="mt-2 space-y-3 text-muted">{cover}</div>

      {/* The page's one action, as a button (Ian, 2026-10-25). */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-y-2 border-rule py-4">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong">
          Measure your own use
        </Link>
        <span className="text-muted">and see what it would cost to cover.</span>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-muted">Other questions</h2>
      <ul className="mt-2 space-y-1">
        {QUESTIONS.filter((o) => o.slug !== q.slug).map((o) => (
          <li key={o.slug}>
            <Link href={`/questions/${o.slug}`} className={link}>
              {o.question}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** A source, linked as the method page lists it. */
export function Cite({ s }: { s: { name: string; url: string } }) {
  return (
    <a href={s.url} target="_blank" rel="noreferrer" className={link}>
      {s.name}
    </a>
  );
}

/** A link to the method page, optionally to one of its sections. */
export function Method({ children = "How it's calculated", hash }: { children?: React.ReactNode; hash?: string }) {
  return (
    <Link href={`/method${hash ? `#${hash}` : ""}`} className={link}>
      {children}
    </Link>
  );
}
