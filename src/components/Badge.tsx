import { type BadgeInfo, FULL_NAME, termLabel, type Tone, toneOf } from "@/lib/badges";
import { fitSeal } from "@/lib/sealFit";

// The badges, drawn like an inked seal on a bill: two rules, the name in
// Fraunces, "My Offset" and the term set round the edge. The ink says the term
// (Ian, 2026-10-13): blue while the future is being paid, "through" a date for a
// month or year or "rest of life" when it's paid for life but past use isn't;
// yellow once past use is paid off in full; green only when past and future are
// both paid for life, or the item is at zero use. Past paid with the future still
// running shows two seals side by side, yellow and blue; green replaces both. The
// colors are the store's tiles' colors. Edges are solid for every term and
// item and aisle seals have no side dots (Ian, 2026-10-13): the color and the
// lettered term already say it.
//
// Three tiers, told apart by how much is printed solid, never by a new color
// (Ian, 2026-10-13): an item is outline only; an aisle fills its center with
// ink, the aisle's icon and name knocked out; Fully Offset is printed solid all
// over, with a scalloped edge, stars and every letter knocked out.

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
const INK_BG: Record<Tone, string> = { life: "bg-life-ink", period: "bg-period-ink", past: "bg-past-ink" };
const INK_BORDER: Record<Tone, string> = { life: "border-life-ink", period: "border-period-ink", past: "border-past-ink" };
const PAPER_TEXT: Record<Tone, string> = { life: "text-life", period: "text-period", past: "text-past" };

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
/** How big an aisle's icon is drawn on the seal's 120-unit grid, and its line weight there. */
const ICON_SIZE = 24;
const ICON_STROKE = 2;

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

/** The round seal, for places with room: results, the record, a gift card, the list's key. */
export function Seal({ kind, name, until, size }: SealProps) {
  const full = kind === "full";
  const aisle = kind === "aisle";
  const tone = toneFor(until);
  const term = termLabel(until).toUpperCase();
  const icon = aisle ? ICONS[name.toLowerCase()] : undefined;
  const fit = full
    ? fitSeal(FULL_NAME, { max: 16, mark: 9 })
    : aisle
      ? fitSeal(name, { max: 15, mark: icon ? ICON_SIZE : 0 })
      : fitSeal(name, { max: 18 });
  const paper = PAPER[tone];
  // Lettering on the solid parts is knocked out in the tone's light tint.
  const edge = full ? paper : "currentColor";
  const center = full || aisle ? paper : "currentColor";
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
          <path d={SCALLOPS} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="60" cy="60" r="39.5" fill="none" stroke={paper} strokeWidth="1" />
        </>
      ) : (
        <>
          <circle cx="60" cy="60" r="57" fill="var(--background)" stroke="currentColor" strokeWidth="2.25" />
          <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.75" />
          <circle cx="60" cy="60" r="39.5" fill={aisle ? "currentColor" : "none"} stroke="currentColor" strokeWidth="0.75" />
        </>
      )}
      {full && <path d={`${star(13.75, 60, 2.6)}${star(106.25, 60, 2.6)}`} fill={edge} />}
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
          <path d={star(60, fit.mark + 0.4, 4.9)} fill={center} />
        ) : (
          icon && (
            <path
              d={icon}
              transform={`translate(60 ${fit.mark}) scale(${ICON_SIZE / 12})`}
              fill="none"
              stroke={center}
              strokeWidth={(ICON_STROKE * 12) / ICON_SIZE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        ))}
      <g fill={center} textAnchor="middle" style={{ fontFamily: "var(--font-head), serif" }}>
        {fit.lines.map((w, i) => (
          <text key={w} x="60" y={fit.baselines[i]} fontSize={fit.fs} fontWeight="600">
            {w}
          </text>
        ))}
      </g>
    </svg>
  );
}

/**
 * A small mark for the start of a tag, stepped like the seals: outline rings for an item; for an
 * aisle, its own symbol knocked out of a filled circle, as on its seal (Ian, 2026-10-13); filled
 * all over with a star for Fully Offset. `big` is the Badge filter's size (Ian, 2026-10-13): a 24px
 * mark whose aisle symbol is about 14px across, against about 8px on a tag.
 */
function Mark({ kind, tone, paper, icon, big }: { kind: BadgeInfo["kind"]; tone: Tone; paper?: string; icon?: string; big?: boolean }) {
  const symbol = kind === "aisle" && icon ? ICONS[icon] : undefined;
  const knock = paper ?? PAPER[tone];
  const px = big ? 24 : 16;
  // The symbol's scale in the 16-unit box, and its line weight there: about 1.6px drawn at 24px.
  const k = big ? 0.78 : 0.66;
  const line = big ? 1.07 : 1.3;
  return (
    <svg viewBox="0 0 16 16" width={px} height={px} aria-hidden="true" className="shrink-0">
      {kind === "full" ? (
        <>
          <circle cx="8" cy="8" r="7.4" fill="currentColor" />
          <path d={star(8, 8.3, 3.2)} fill={knock} />
        </>
      ) : symbol ? (
        <>
          <circle cx="8" cy="8" r="7.6" fill="currentColor" />
          <path
            d={symbol}
            transform={`translate(8 8) scale(${k})`}
            fill="none"
            stroke={knock}
            strokeWidth={line / k}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {kind === "aisle" ? (
            <circle cx="8" cy="8" r="4.3" fill="currentColor" />
          ) : (
            <circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
          )}
        </>
      )}
    </svg>
  );
}

/** A tag's name: just the badge's name, "AI" not "AI offset" (Ian, 2026-10-13); Fully Offset says it already. */
const tagLabel = (b: Pick<BadgeInfo, "kind" | "name">) => (b.kind === "full" ? FULL_NAME : b.name);

/**
 * The badge as a tag for lists and tight spaces: the same rings, the name, and the term after a rule.
 * `icon` is an aisle's key, for its symbol.
 * A badge showing yellow and blue together is one split tag (Ian, 2026-10-13): the name in the first
 * color, then each term in its own color, "PAST USE" then "THROUGH AUG 2027".
 */
export function BadgeTag({ kind, name, until, icon }: Omit<SealProps, "size" | "until"> & { until: Term | Term[]; icon?: string }) {
  const full = kind === "full";
  const untils = Array.isArray(until) ? until : [until];
  const tone = toneFor(untils[0]);
  return (
    <span className="inline-flex items-stretch text-sm leading-none">
      <span className={`inline-flex items-center gap-1.5 rounded-l-sm border-[1.5px] py-1.5 pr-2 pl-1.5 ${TAG[tone]}`}>
        <Mark kind={kind} tone={tone} icon={icon} />
        <span className="font-display font-semibold">{tagLabel({ kind, name })}</span>
      </span>
      {untils.map((u, i) => {
        const t = toneFor(u);
        return (
          // Fully Offset's term is printed solid, like its seal.
          <span
            key={String(u)}
            className={`inline-flex items-center border-y-[1.5px] border-r-[1.5px] px-2 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase ${
              full ? `${INK_BORDER[t]} ${INK_BG[t]} ${PAPER_TEXT[t]}` : TAG[t]
            } ${i === untils.length - 1 ? "rounded-r-sm" : ""}`}
          >
            {termLabel(u)}
          </span>
        );
      })}
    </span>
  );
}

/** One badge with all the terms it shows: one, or yellow then blue. */
type Grouped = Omit<BadgeInfo, "until"> & { untils: (string | null)[] };

function grouped(badges: BadgeInfo[]): Grouped[] {
  const out: Grouped[] = [];
  for (const b of badges) {
    const g = out.find((x) => x.kind === b.kind && x.key === b.key);
    if (g) g.untils.push(b.until);
    else out.push({ ...b, untils: [b.until] });
  }
  return out;
}

/**
 * A row of badges, highest tier up front, with the lower ones earned inside it folded away
 * (Ian, 2026-10-13), so a Fully Offset person doesn't see 38 at once.
 *
 * As tags (the list), each badge is one tag, its yellow and blue in one split tag. Fully Offset
 * stands alone; an aisle's items fold under a quiet "N items" at the end of the row. As
 * `seals` (the record, a gift card), the lower ones fold under "and N more inside" below.
 * `end` sets the tags to the right, for a row with the name on the left. `topOnly` drops the fold, for
 * the list, where opening the row shows everything as seals (Ian, 2026-10-13).
 */
export function BadgeList({
  badges,
  seals,
  label = "Badges",
  end,
  topOnly,
}: {
  badges: BadgeInfo[];
  seals?: boolean;
  label?: string;
  end?: boolean;
  topOnly?: boolean;
}) {
  const parent = (b: BadgeInfo) => (b.within ? badges.find((x) => x.kind !== "item" && x.key === b.within) : undefined);
  const top = badges.filter((b) => !parent(b));
  const lower = badges.filter((b) => !top.includes(b));
  if (!seals) {
    const tops = grouped(top);
    const more = topOnly || tops.some((b) => b.kind === "full") ? [] : grouped(lower);
    const tag = (b: Grouped) => <BadgeTag kind={b.kind} name={b.name} until={b.untils} icon={b.kind === "aisle" ? b.key : undefined} />;
    return (
      <ul className={`flex flex-wrap items-center gap-2 ${end ? "sm:justify-end" : ""}`} aria-label={label}>
        {tops.map((b) => (
          <li key={`${b.kind}:${b.key}`}>{tag(b)}</li>
        ))}
        {more.length > 0 && (
          <li className="has-[details[open]]:basis-full">
            <details className={end ? "sm:text-right" : ""}>
              <summary className="inline-flex min-h-8 cursor-pointer items-center text-xs text-muted underline underline-offset-4 hover:text-foreground">
                {more.length === 1 ? "1 item" : `${more.length} items`}
              </summary>
              <ul className={`mt-1 flex flex-wrap gap-2 ${end ? "sm:justify-end" : ""}`} aria-label={`${label} inside`}>
                {more.map((b) => (
                  <li key={`${b.kind}:${b.key}`}>{tag(b)}</li>
                ))}
              </ul>
            </details>
          </li>
        )}
      </ul>
    );
  }
  const n = new Set(lower.map((b) => b.key)).size;
  // One size and one even gap across a row, a badge's yellow and blue included (Ian, 2026-10-13:
  // pairs shouldn't sit closer together).
  const row = (bs: BadgeInfo[], aria: string) => (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-4" aria-label={aria}>
      {grouped(bs).flatMap((b) =>
        b.untils.map((u) => (
          <li key={`${b.kind}:${b.key}:${String(u)}`}>
            <Seal kind={b.kind} name={b.name} until={u} size={ROW_SIZE} />
          </li>
        )),
      )}
    </ul>
  );
  return (
    <>
      {top.length > 0 && row(top, label)}
      {n > 0 && (
        <details className={top.length ? "mt-2" : ""}>
          <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm underline underline-offset-4">
            {top.length ? `and ${n} more inside` : `See the ${n} badges inside`}
          </summary>
          <div className="mt-1">{row(lower, `${label} inside`)}</div>
        </details>
      )}
    </>
  );
}

/** Every seal in a row of the record or a gift card, so a row reads even. */
const ROW_SIZE = 112;

/** The seals in an opened list row, one size across the row: a step up from the record's, so about four fit across on a desktop and two on a phone. */
const OPEN_SIZE = 144;

/**
 * A person's badges, opened up on the list (Ian, 2026-10-13): each badge shown up front as its round
 * seal, yellow and blue evenly spaced like the rest. The seals stand alone, with no list of what's inside (Ian, 2026-10-13).
 */
export function SealGrid({ badges, label }: { badges: BadgeInfo[]; label: string }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-5" aria-label={label}>
      {grouped(badges.filter((b) => !b.within)).flatMap((b) =>
        b.untils.map((u) => (
          <li key={`${b.kind}:${b.key}:${String(u)}`}>
            <Seal kind={b.kind} name={b.name} until={u} size={OPEN_SIZE} />
          </li>
        )),
      )}
    </ul>
  );
}

/** A filter chip in the badges' own look (Ian, 2026-10-13): a tag in its color, filled solid when chosen. */
const CHIP_OFF: Record<Tone | "plain", string> = { ...TAG, plain: "border-rule bg-background text-foreground" };
const CHIP_ON: Record<Tone | "plain", string> = {
  life: "border-life-ink bg-life-ink text-life",
  period: "border-period-ink bg-period-ink text-period",
  past: "border-past-ink bg-past-ink text-past",
  plain: "border-foreground bg-foreground text-background",
};

/**
 * A toggle that submits the list's filter form: `name=value` when pressed on, and `back` (or
 * nothing, for everyone) when pressed off. Works without JavaScript.
 */
export function FilterTag({
  label,
  tone,
  kind,
  on,
  count,
  name,
  value,
  back,
  icon,
}: {
  label: string;
  /** An aisle's key, for its symbol. */
  icon?: string;
  tone?: Tone;
  /** The badge mark to show, if any. */
  kind?: BadgeInfo["kind"];
  on: boolean;
  count?: number;
  name?: string;
  value?: string;
  /** What pressing it off goes back to, as [name, value]. */
  back?: [string, string];
}) {
  const look = tone ?? "plain";
  const [n, v] = on ? (back ?? []) : [name, value];
  return (
    <button
      type="submit"
      name={n}
      value={v}
      aria-pressed={on}
      className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-sm border-[1.5px] px-2.5 text-sm leading-none ${on ? CHIP_ON[look] : CHIP_OFF[look]}`}
    >
      {/* The Badge row's marks are drawn bigger, so the aisle symbols read; the button keeps its 40px height. */}
      {kind && <Mark kind={kind} icon={icon} big={kind !== "item"} tone={tone ?? "life"} paper={tone ? undefined : on ? "var(--foreground)" : "var(--background)"} />}
      <span className="font-display font-semibold">{label}</span>
      {count !== undefined && <span className="amount text-xs">{count}</span>}
    </button>
  );
}
