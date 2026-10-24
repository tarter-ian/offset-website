// The problem, one screen at a time, then the bill (Ian, 2026-10-24: stretch the opening out
// without putting more on any one screen, and let drawings carry it where they can).
// Every claim here is one the method page sources.
import type { ReactNode } from "react";

/** Line drawings in ink, so they follow dark mode. */
function Drawing({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 180"
      role="img"
      aria-label={label}
      className="w-48 text-foreground sm:w-64 md:w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ground = <path d="M10 160H230" />;

const racks = (
  <Drawing label="Rows of servers in a data center">
    {[40, 97, 154].map((x) => (
      <g key={x}>
        <rect x={x} y={30} width={46} height={130} rx={3} />
        {[50, 72, 94, 116, 138].map((y) => (
          <g key={y}>
            <path d={`M${x + 8} ${y}H${x + 28}`} />
            <circle cx={x + 37} cy={y} r={2.5} fill="currentColor" stroke="none" />
          </g>
        ))}
      </g>
    ))}
    {ground}
  </Drawing>
);

const plant = (
  <Drawing label="A power plant with a smoking chimney beside a power line">
    <rect x={30} y={112} width={88} height={48} />
    <path d="M44 112V96L64 104V112M64 104V96L84 104V112" />
    <path d="M128 160L133 52H147L152 160" />
    <g opacity={0.55}>
      <circle cx={150} cy={38} r={9} />
      <circle cx={168} cy={25} r={12} />
      <circle cx={190} cy={15} r={14} />
    </g>
    <path d="M190 160L203 78L216 160M195 128H211M193 98H213M186 88H220M220 88C228 92 234 92 240 90" />
    {ground}
  </Drawing>
);

const cooling = (
  <Drawing label="A cooling tower giving off water vapor">
    <path d="M62 160C80 120 82 88 74 56H150C142 88 144 120 162 160" />
    <path d="M78 74H146" opacity={0.5} />
    <g opacity={0.55}>
      <path d="M92 46C82 36 102 26 92 14" />
      <path d="M112 46C102 36 122 26 112 14" />
      <path d="M132 46C122 36 142 26 132 14" />
    </g>
    <path d="M205 96C205 96 192 114 192 123A13 13 0 0 0 218 123C218 114 205 96 205 96Z" />
    {ground}
  </Drawing>
);

const land = (
  <Drawing label="Trees on one side, cleared ground with a power plant on the other">
    {[16, 42, 68].map((x) => (
      <g key={x}>
        <path d={`M${x} 140L${x + 11} 104L${x + 22} 140Z`} />
        <path d={`M${x + 11} 140V160`} />
      </g>
    ))}
    <path d="M100 160V153H107V160M114 160V154H121V160" />
    <rect x={140} y={116} width={56} height={44} />
    <path d="M154 116V100H164V116M176 116V92H186V116" />
    <path d="M130 160V150M206 160V150M130 150H206" strokeDasharray="4 5" opacity={0.6} />
    {ground}
  </Drawing>
);

// How one person's use adds up: the same use counted over a question, a day, a year and a lifetime.
const adds = (
  <Drawing label="A bar chart: a question, a day, a year and a lifetime of AI use, each bar much taller than the last">
    {(
      [
        [28, 2, "a question"],
        [84, 10, "a day"],
        [140, 48, "a year"],
        [196, 128, "a lifetime"],
      ] as const
    ).map(([x, h, name]) => (
      <g key={name}>
        <rect x={x} y={150 - h} width={30} height={h} fill="currentColor" stroke="none" opacity={0.85} />
        <text x={x + 15} y={172} textAnchor="middle" fontSize={11} fill="currentColor" stroke="none">
          {name}
        </text>
      </g>
    ))}
    <path d="M14 150H232" />
  </Drawing>
);

const STEPS: { head: string; body?: string; art: ReactNode }[] = [
  { head: "Every AI answer comes from a data center.", art: racks },
  { head: "It runs mostly on power from gas and coal.", body: "That means carbon in the air, and smog where people breathe.", art: plant },
  { head: "It's cooled with water.", body: "Often where water is already short.", art: cooling },
  { head: "And the power takes up land.", art: land },
  { head: "One question is tiny. Years of them aren't.", body: "Nobody sends you the bill.", art: adds },
];

export function Story() {
  return (
    <div aria-label="Why offset your AI use">
      {STEPS.map((s, i) => (
        <section
          key={s.head}
          className="grid min-h-[80svh] content-center gap-8 border-b border-border py-16 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:gap-14"
        >
          <div className="md:order-2">{s.art}</div>
          <div>
            <h2 className="max-w-2xl font-display text-4xl leading-[1.1] font-semibold sm:text-6xl">{s.head}</h2>
            {s.body && <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">{s.body}</p>}
            {i === 0 && (
              <p aria-hidden="true" className="mt-12 text-2xl text-muted">
                ↓
              </p>
            )}
          </div>
        </section>
      ))}
      <section className="flex min-h-[60svh] flex-col justify-center py-16">
        <h2 className="max-w-3xl font-display text-4xl leading-[1.1] font-semibold sm:text-6xl">So here&apos;s yours.</h2>
        <p className="mt-10">
          <a
            href="#your-bill"
            className="inline-flex min-h-11 items-center rounded-md border-2 border-rule px-5 font-semibold hover:bg-foreground hover:text-background"
          >
            See your bill ↓
          </a>
        </p>
      </section>
    </div>
  );
}
