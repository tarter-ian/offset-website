import { type BadgeInfo, FULL_NAME, termLabel, type Tone, toneOf } from "@/lib/badges";
import { fitSeal } from "@/lib/sealFit";

// The badges, drawn like an inked seal on a bill: two rules, the name in
// Fraunces, "My Offset" and the term set round the edge. Lifetime and past-use
// seals have a solid edge; seals that run through a date have a perforated one,
// like a ticket stub. The ink says the term (Ian, 2026-10-13): green for life,
// blue for a month or year, yellow for past use, the same colors as the store's
// tiles. Fully Offset keeps its term's color and is set apart by form: its edge
// band is printed solid with the lettering knocked out.

type Term = string | null | "monthly";

export interface SealProps {
  kind: BadgeInfo["kind"];
  name: string;
  until: Term;
  /** Width in pixels. Below about 96 the edge lettering stops reading; use BadgeTag there. */
  size?: number;
}

const toneFor = (until: Term): Tone => (until === "monthly" ? "period" : toneOf(until));

/** Ink and paper for each tone, from the tokens in globals.css. */
const INK: Record<Tone, string> = { life: "text-life-ink", period: "text-period-ink", past: "text-past-ink" };
const PAPER: Record<Tone, string> = { life: "var(--life)", period: "var(--period)", past: "var(--past)" };
const TAG: Record<Tone, string> = {
  life: "border-life-ink bg-life text-life-ink",
  period: "border-period-ink bg-period text-period-ink",
  past: "border-past-ink bg-past text-past-ink",
};

export const badgeLabel = (b: Pick<BadgeInfo, "kind" | "name">) => (b.kind === "full" ? FULL_NAME : `${b.name} offset`);

/** The round seal, for places with room: results, the record, a gift card, the list's key. */
export function Seal({ kind, name, until, size = 112 }: SealProps) {
  const full = kind === "full";
  const tone = toneFor(until);
  const dated = tone === "period";
  const term = termLabel(until).toUpperCase();
  const fit = full ? fitSeal(FULL_NAME, { tail: false, max: 17 }) : fitSeal(name, { max: 18 });
  const paper = PAPER[tone];
  // On Fully Offset the edge lettering is knocked out of a solid band.
  const edge = full ? paper : "currentColor";
  const id = `seal-${kind}-${name}-${until ?? "life"}`.replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`${badgeLabel({ kind, name })}, ${termLabel(until)}`}
      className={`shrink-0 ${INK[tone]}`}
    >
      <defs>
        <path id={`${id}-t`} d="M 16.5 60 A 43.5 43.5 0 0 1 103.5 60" />
        <path id={`${id}-b`} d="M 11 60 A 49 49 0 0 0 109 60" />
      </defs>
      <circle cx="60" cy="60" r="57" fill={paper} stroke="currentColor" strokeWidth="2.25" strokeDasharray={dated ? "2.2 1.9" : undefined} />
      {full ? (
        <circle cx="60" cy="60" r="46.25" fill="none" stroke="currentColor" strokeWidth="13.5" />
      ) : (
        <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.75" />
      )}
      <circle cx="60" cy="60" r="39.5" fill="none" stroke="currentColor" strokeWidth={full ? 1.5 : 0.75} />
      <circle cx="13.75" cy="60" r="1.3" fill={edge} />
      <circle cx="106.25" cy="60" r="1.3" fill={edge} />
      <g fill={edge} style={{ fontFamily: "var(--font-body), sans-serif" }} fontSize="7.6" fontWeight="600" letterSpacing="1.5">
        <text>
          <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">
            MY OFFSET
          </textPath>
        </text>
        <text>
          <textPath href={`#${id}-b`} startOffset="50%" textAnchor="middle" letterSpacing={term.length > 12 ? 0.9 : 1.5}>
            {term}
          </textPath>
        </text>
      </g>
      <g fill="currentColor" textAnchor="middle" style={{ fontFamily: "var(--font-head), serif" }}>
        {fit.lines.map((w, i) => (
          <text key={w} x="60" y={fit.baselines[i]} fontSize={fit.fs} fontWeight="600">
            {w}
          </text>
        ))}
        {fit.rule !== undefined && fit.tail !== undefined && (
          <>
            <line x1="50" x2="70" y1={fit.rule} y2={fit.rule} stroke="currentColor" strokeWidth="0.75" />
            <text x="60" y={fit.tail} fontSize="10.5" fontStyle="italic">
              offset
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

/** A small mark for the start of a tag: the seal's two rings. */
function Mark({ dated }: { dated: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dated ? "1.6 1.3" : undefined} />
      <circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** The badge as a tag for lists and tight spaces: the same rings, the name, and the term after a rule. */
export function BadgeTag({ kind, name, until }: Omit<SealProps, "size">) {
  const full = kind === "full";
  const tone = toneFor(until);
  const dated = tone === "period";
  return (
    <span className={`inline-flex items-stretch rounded-sm border-[1.5px] text-sm leading-none ${dated ? "border-dashed" : "border-solid"} ${TAG[tone]}`}>
      <span className="inline-flex items-center gap-1.5 py-1.5 pr-2 pl-1.5">
        <Mark dated={dated} />
        <span className="font-display font-semibold">{badgeLabel({ kind, name })}</span>
      </span>
      {/* Fully Offset's term is printed solid, like its seal's band. */}
      <span
        className={`inline-flex items-center border-l border-current px-2 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ${
          full ? `${INK_BG[tone]} ${PAPER_TEXT[tone]}` : ""
        }`}
      >
        {termLabel(until)}
      </span>
    </span>
  );
}

const INK_BG: Record<Tone, string> = { life: "bg-life-ink", period: "bg-period-ink", past: "bg-past-ink" };
const PAPER_TEXT: Record<Tone, string> = { life: "text-life", period: "text-period", past: "text-past" };
