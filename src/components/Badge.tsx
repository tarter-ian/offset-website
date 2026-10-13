import { type BadgeInfo, FULL_NAME, termLabel, type Tone, toneOf } from "@/lib/badges";
import { fitSeal } from "@/lib/sealFit";

// The badges, drawn like an inked seal on a bill: two rules, the name in
// Fraunces, "My Offset" and the term set round the edge. Lifetime and past-use
// seals have a solid edge; seals that run through a date have a perforated one,
// like a ticket stub. The ink says the term (Ian, 2026-10-13): green for life,
// blue for a month or year, yellow for past use, the same colors as the store's
// tiles.
//
// Three tiers, told apart by form only, never by a new color (Ian, 2026-10-13):
// an item has two rings and its name; an aisle adds a beaded ring and the
// aisle's line icon; Fully Offset adds a scalloped edge, a solid printed band
// with the lettering knocked out, and a star.

type Term = string | null | "monthly";

export interface SealProps {
  kind: BadgeInfo["kind"];
  name: string;
  until: Term;
  /** Width in pixels; each tier has its own, a step up from the one below. Below about 96 the edge lettering stops reading; use BadgeTag there. */
  size?: number;
}

/** Default widths, so a row of seals steps up from item to aisle to Fully Offset. */
const SIZE: Record<BadgeInfo["kind"], number> = { item: 104, aisle: 112, full: 120 };

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

/** Each aisle's icon: single-weight line drawings on a 12-unit square centered on 0,0. */
const ICONS: Record<string, string> = {
  ai: "M0 -6C0.7 -1.7 1.7 -0.7 6 0C1.7 0.7 0.7 1.7 0 6C-0.7 1.7 -1.7 0.7 -6 0C-1.7 -0.7 -0.7 -1.7 0 -6Z",
  online: "M-5.6 0A5.6 5.6 0 1 0 5.6 0A5.6 5.6 0 1 0 -5.6 0ZM0 -5.6C-3.2 -2.6 -3.2 2.6 0 5.6C3.2 2.6 3.2 -2.6 0 -5.6ZM-5.6 0H5.6",
  devices: "M-4.4 -4.6H4.4V2.2H-4.4ZM-6 4.6H6",
  home: "M-5.8 -0.2L0 -5.6L5.8 -0.2M-4.2 -1.6V5.4H4.2V-1.6M-1.3 5.4V2H1.3V5.4",
  travel: "M0 -6V5.6M-5.8 1.4L0 -1.6L5.8 1.4M-2.6 5.8L0 4.6L2.6 5.8",
  food: "M-3 -6V6M-4.8 -6V-2.6C-4.8 -1.4 -4 -0.8 -3 -0.8C-2 -0.8 -1.2 -1.4 -1.2 -2.6V-6M3 6V-6C4.8 -4.6 5.2 -2.4 5.2 0.4H3",
  shopping: "M-4.8 -2H4.8L5.4 5.6H-5.4ZM-2.2 -2V-3.4A2.2 2.2 0 0 1 2.2 -3.4V-2",
};
ICONS.digital = ICONS.online;
/** How big an aisle's icon is drawn on the seal's 120-unit grid. */
const ICON_SIZE = 13;

/** A five-point star of outer radius r at x, y. */
function star(x: number, y: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r * 0.45 : r;
    return `${(x + k * Math.cos(a)).toFixed(2)} ${(y + k * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

/** Fully Offset's scalloped edge: 32 shallow arcs round the seal, peaking just inside the frame. */
const SCALLOPS = (() => {
  const n = 32;
  const r = 55.4;
  const at = (i: number) => {
    const a = (i * 2 * Math.PI) / n;
    return `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M${at(0)}${Array.from({ length: n }, (_, i) => `A7.3 7.3 0 0 1 ${at(i + 1)}`).join("")}Z`;
})();

/** The beaded ring aisles and Fully Offset add inside the inner rule. */
const BEADS_R = 36.6;
/** How far the name may reach inside the beads, keeping the same clear gap as the item's ring. */
const BEADED_FIELD = 33.2;

/** The round seal, for places with room: results, the record, a gift card, the list's key. */
export function Seal({ kind, name, until, size }: SealProps) {
  const full = kind === "full";
  const aisle = kind === "aisle";
  const tone = toneFor(until);
  const dated = tone === "period";
  const term = termLabel(until).toUpperCase();
  const icon = aisle ? ICONS[name.toLowerCase()] : undefined;
  const fit = full
    ? fitSeal(FULL_NAME, { tail: false, max: 16, field: BEADED_FIELD, mark: 9 })
    : aisle
      ? fitSeal(name, { max: 17, field: BEADED_FIELD, mark: icon ? ICON_SIZE : 0 })
      : fitSeal(name, { max: 18 });
  const paper = PAPER[tone];
  // On Fully Offset the edge lettering is knocked out of a solid band.
  const edge = full ? paper : "currentColor";
  const id = `seal-${kind}-${name}-${until ?? "life"}`.replace(/[^a-zA-Z0-9-]/g, "");
  const px = size ?? SIZE[kind];
  return (
    <svg
      viewBox="0 0 120 120"
      width={px}
      height={px}
      role="img"
      aria-label={`${badgeLabel({ kind, name })}, ${termLabel(until)}`}
      className={`shrink-0 ${INK[tone]}`}
    >
      <defs>
        <path id={`${id}-t`} d="M 16.5 60 A 43.5 43.5 0 0 1 103.5 60" />
        <path id={`${id}-b`} d="M 11 60 A 49 49 0 0 0 109 60" />
      </defs>
      {full ? (
        <>
          <path d={SCALLOPS} fill={paper} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray={dated ? "2.2 1.6" : undefined} />
          <circle cx="60" cy="60" r="46.25" fill="none" stroke="currentColor" strokeWidth="13.5" />
        </>
      ) : (
        <>
          <circle cx="60" cy="60" r="57" fill={paper} stroke="currentColor" strokeWidth="2.25" strokeDasharray={dated ? "2.2 1.9" : undefined} />
          <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth={aisle ? 1.2 : 0.75} />
          {/* An aisle's frame is a double rule, clear of the edge lettering. */}
          {aisle && <circle cx="60" cy="60" r="51.2" fill="none" stroke="currentColor" strokeWidth="0.6" />}
        </>
      )}
      <circle cx="60" cy="60" r="39.5" fill="none" stroke="currentColor" strokeWidth={full ? 1.5 : 0.75} />
      {(full || aisle) && (
        <circle cx="60" cy="60" r={BEADS_R} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="0 2.5" />
      )}
      {full ? (
        <path d={`${star(13.75, 60, 2.6)}${star(106.25, 60, 2.6)}`} fill={edge} />
      ) : (
        <>
          <circle cx="13.75" cy="60" r="1.3" fill={edge} />
          <circle cx="106.25" cy="60" r="1.3" fill={edge} />
        </>
      )}
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
      {fit.mark !== undefined &&
        (full ? (
          <path d={star(60, fit.mark + 0.4, 4.9)} fill="currentColor" />
        ) : (
          icon && (
            <path
              d={icon}
              transform={`translate(60 ${fit.mark}) scale(${ICON_SIZE / 12})`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        ))}
      <g fill="currentColor" textAnchor="middle" style={{ fontFamily: "var(--font-head), serif" }}>
        {fit.lines.map((w, i) => (
          <text key={w} x="60" y={fit.baselines[i]} fontSize={fit.fs} fontWeight="600">
            {w}
          </text>
        ))}
        {fit.rule !== undefined && fit.tail !== undefined && (
          <text x="60" y={fit.tail} fontSize="10.5" fontStyle="italic">
            offset
          </text>
        )}
      </g>
    </svg>
  );
}

/** A small mark for the start of a tag, stepped like the seals: two rings for an item, a beaded ring for an aisle, a solid band for Fully Offset. */
function Mark({ kind, dated }: { kind: BadgeInfo["kind"]; dated: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="shrink-0">
      {kind === "full" ? (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="3.4" strokeDasharray={dated ? "2.2 1.1" : undefined} />
          <path d={star(8, 8.3, 2.9)} fill="currentColor" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={dated ? "1.6 1.3" : undefined} />
          {kind === "aisle" ? (
            <>
              <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0 2.3" />
              <circle cx="8" cy="8" r="1.7" fill="currentColor" />
            </>
          ) : (
            <circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
          )}
        </>
      )}
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
        <Mark kind={kind} dated={dated} />
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
