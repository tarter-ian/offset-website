import { termPhrase } from "@/lib/badges";
import type { Covered } from "@/lib/covered";
import { productById, SECTIONS } from "@/lib/store";

// What's offset, as a timeline (Ian, 2026-10-13): one row per aisle when everything in it was
// paid the same way, else one per item. Left of today is past use, right is what's offset ahead:
// the next year to scale, then the rest of life.
//
// Someone with a lot offset sees the first three rows and a "Show all" to open the rest in place
// (Ian, 2026-10-13). Fully Offset gets the same rows, with a few words beside the heading.

const TODAY = 25;
const YEAR = 70;
/** Rows shown before the rest fold away. */
const FIRST = 3;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

interface Row {
  name: string;
  cover: Covered;
}

/** Aisles whose covered items all share one cover become a row; the rest are a row each. */
function rows(covered: Record<string, Covered>): Row[] {
  const out: Row[] = [];
  const key = (c: Covered) => `${c.kind}|${c.kind === "period" ? c.until.slice(0, 10) : ""}|${c.past ?? ""}|${c.giftFrom ?? ""}`;
  for (const sec of SECTIONS) {
    const items = Object.entries(covered).filter(([id]) => productById(id)?.section === sec.key);
    if (!items.length) continue;
    const names = items.map(([id]) => productById(id)!.name);
    if (items.length > 1 && items.every(([, c]) => key(c) === key(items[0][1]))) {
      out.push({ name: `${sec.title}: ${list(names.map((n) => lower(n.replace(/^AI /, ""))))}`, cover: items[0][1] });
    } else out.push(...items.map(([, c], i) => ({ name: names[i], cover: c })));
  }
  return out;
}

function detail(c: Covered): string {
  const past = c.past ? ", past use included" : "";
  const what =
    c.kind === "life"
      ? c.past === false
        ? "All future use"
        : `For life${past}`
      : `Through ${day(c.until)}${past}`;
  return c.giftFrom ? `${what} · a gift from ${c.giftFrom}` : what;
}

/** Where a period cover ends on the track: the next year is to scale, anything later sits past it. */
function endAt(c: Covered, now: number): number {
  if (c.kind === "life") return 100;
  const months = (Date.parse(c.until) - now) / (30.44 * 86400000);
  return months <= 12 ? TODAY + ((YEAR - TODAY) * Math.max(0.5, months)) / 12 : Math.min(98, YEAR + months / 4);
}

function Line({ row: r, now }: { row: Row; now: number }) {
  const color = r.cover.kind === "life" ? "bg-life-ink" : "bg-period-ink";
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center">
      <span className="font-semibold">{r.name}</span>
      {/* The term is said only to screen readers; the bar and the dated axis show it (Ian, 2026-10-13). */}
      <div className="relative h-5" role="img" aria-label={detail(r.cover)}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {r.cover.past && <span className={`absolute top-1 bottom-1 left-0 rounded-l-sm opacity-40 ${color}`} style={{ width: `${TODAY}%` }} />}
        <span
          className={`absolute top-1 bottom-1 ${r.cover.kind === "life" ? "rounded-l-sm" : "rounded-sm"} ${color}`}
          style={{ left: `${TODAY}%`, width: `${endAt(r.cover, now) - TODAY}%` }}
        />
        <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground" style={{ left: `${TODAY}%` }} />
      </div>
    </li>
  );
}

/**
 * `full` is the Fully Offset badges' terms, when the person is Fully Offset, for the note by the heading. `since` is the year
 * the earliest paid past use starts, for the axis's left end (Ian, 2026-10-13).
 */
export function OffsetTimeline({
  covered,
  full = [],
  since,
  now = Date.now(),
}: {
  covered: Record<string, Covered>;
  full?: (string | null)[];
  since?: number;
  now?: number;
}) {
  const all = rows(covered);
  if (!all.length) return null;
  const shown = all.slice(0, FIRST);
  const rest = all.slice(FIRST);
  // Real dates where they're exact; the far end stays words (Ian, 2026-10-13).
  const inAYear = new Date(now + 365.25 * 86400000).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <section aria-labelledby="offset-timeline-heading">
      {/* The paid hero's headline (Ian, 2026-10-13). */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 id="offset-timeline-heading" className="font-display text-2xl font-semibold">
          What you&apos;ve offset
        </h1>
        {full.length > 0 && <p className="text-sm font-semibold">Fully Offset {termPhrase(full)}</p>}
      </div>
      <div className="mt-3 hidden text-xs text-muted sm:grid sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-x-4" aria-hidden="true">
        <span />
        <div className="relative h-4">
          <span className="absolute left-0">{since ? `Since ${since}` : "Past use"}</span>
          <span className="absolute -translate-x-1/2 font-semibold text-foreground" style={{ left: `${TODAY}%` }}>
            Today
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${YEAR}%` }}>
            {inAYear}
          </span>
          <span className="absolute right-0">For life →</span>
        </div>
      </div>
      <ul className="mt-1 border-t border-rule">
        {shown.map((r) => (
          <Line key={r.name} row={r} now={now} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 hover:text-muted">
            <span className="group-open:hidden">Show all {all.length}</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="border-t border-border" aria-label="The rest of what you've offset">
            {rest.map((r) => (
              <Line key={r.name} row={r} now={now} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
