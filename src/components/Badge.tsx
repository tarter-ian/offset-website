import { type BadgeInfo, FULL_NAME, termLabel } from "@/lib/badges";

// The badges, drawn like an inked seal on a bill: two rules, the name in
// Fraunces, "My Offset" and the term set round the edge. Lifetime seals have
// a solid edge; seals that run through a date have a perforated one, like a
// ticket stub. Ink only, with green kept for Fully Offset (Ian, 2026-10-13).

type Term = string | null | "monthly";

export interface SealProps {
  kind: BadgeInfo["kind"];
  name: string;
  until: Term;
  /** Width in pixels. Below about 96 the edge lettering stops reading; use BadgeTag there. */
  size?: number;
}

/** Splits a name into one or two balanced lines. */
function lines(name: string): string[] {
  const words = name.split(" ");
  if (name.length <= 7 || words.length === 1) return [name];
  let best = [name];
  let worst = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(a.length, b.length);
    if (w < worst) [best, worst] = [[a, b], w];
  }
  return best;
}

export const badgeLabel = (b: Pick<BadgeInfo, "kind" | "name">) => (b.kind === "full" ? FULL_NAME : `${b.name} offset`);

/** The round seal, for places with room: results, the record, a gift card, the list's key. */
export function Seal({ kind, name, until, size = 112 }: SealProps) {
  const full = kind === "full";
  const life = until === null;
  const term = termLabel(until).toUpperCase();
  const words = full ? ["Fully", "Offset"] : lines(name);
  const longest = Math.max(...words.map((w) => w.length));
  const fs = full ? 17 : Math.max(12, Math.min(19, (words.length === 1 ? 72 : 68) / (longest * 0.5)));
  const tail = full ? 0 : 13;
  const height = words.length * fs * 0.98 + tail;
  const top = 60 - height / 2;
  const id = `seal-${kind}-${name}-${until ?? "life"}`.replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`${badgeLabel({ kind, name })}, ${termLabel(until)}`}
      className={`shrink-0 ${full ? "text-accent" : "text-foreground"}`}
    >
      <defs>
        <path id={`${id}-t`} d="M 16.5 60 A 43.5 43.5 0 0 1 103.5 60" />
        <path id={`${id}-b`} d="M 11 60 A 49 49 0 0 0 109 60" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="var(--background)" stroke="currentColor" strokeWidth="2.25" strokeDasharray={life ? undefined : "2.2 1.9"} />
      <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="60" cy="60" r="39.5" fill="none" stroke="currentColor" strokeWidth={full ? 1.5 : 0.75} />
      <circle cx="13.75" cy="60" r="1.3" fill="currentColor" />
      <circle cx="106.25" cy="60" r="1.3" fill="currentColor" />
      <g fill="currentColor" style={{ fontFamily: "var(--font-body), sans-serif" }} fontSize="7.6" fontWeight="600" letterSpacing="1.5">
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
        {words.map((w, i) => (
          <text key={w} x="60" y={top + fs * 0.8 + i * fs * 0.98} fontSize={fs} fontWeight="600" letterSpacing="-0.2">
            {w}
          </text>
        ))}
        {!full && (
          <>
            <line x1="50" x2="70" y1={top + words.length * fs * 0.98 + 2} y2={top + words.length * fs * 0.98 + 2} stroke="currentColor" strokeWidth="0.75" />
            <text x="60" y={top + height} fontSize="10.5" fontStyle="italic">
              offset
            </text>
          </>
        )}
      </g>
    </svg>
  );
}

/** A small mark for the start of a tag: the seal's two rings. */
function Mark({ life }: { life: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={life ? undefined : "1.6 1.3"} />
      <circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** The badge as a tag for lists and tight spaces: the same rings, the name, and the term after a rule. */
export function BadgeTag({ kind, name, until }: Omit<SealProps, "size">) {
  const full = kind === "full";
  const life = until === null;
  return (
    <span
      className={`inline-flex items-stretch rounded-sm border-[1.5px] text-sm leading-none ${life ? "border-solid" : "border-dashed"} ${
        full ? "border-accent text-accent" : "border-rule text-foreground"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 py-1.5 pr-2 pl-1.5">
        <Mark life={life} />
        <span className="font-display font-semibold">{badgeLabel({ kind, name })}</span>
      </span>
      <span className={`inline-flex items-center border-l px-2 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ${full ? "border-accent" : "border-rule"}`}>
        {termLabel(until)}
      </span>
    </span>
  );
}
