import type { Covered } from "@/lib/covered";
import { productById, SECTIONS } from "@/lib/store";

// What's offset, as a timeline (Ian, 2026-10-13): one row per aisle when everything in it was
// paid the same way, else one per item. Left of today is past use, right is what's offset ahead:
// the next year to scale, then the rest of life.

const TODAY = 25;
const YEAR = 70;
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

export function OffsetTimeline({ covered, now = Date.now() }: { covered: Record<string, Covered>; now?: number }) {
  const list = rows(covered);
  if (!list.length) return null;
  return (
    <section aria-labelledby="offset-timeline-heading">
      <h2 id="offset-timeline-heading" className="font-display text-2xl font-semibold">
        What you&apos;ve offset
      </h2>
      <div className="mt-3 hidden text-xs text-muted sm:grid sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-x-4" aria-hidden="true">
        <span />
        <div className="relative h-4">
          <span className="absolute left-0">Past use</span>
          <span className="absolute -translate-x-1/2 font-semibold text-foreground" style={{ left: `${TODAY}%` }}>
            Today
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${YEAR}%` }}>
            In a year
          </span>
          <span className="absolute right-0">For life →</span>
        </div>
      </div>
      <ul className="mt-1 border-t border-rule">
        {list.map((r) => {
          const color = r.cover.kind === "life" ? "bg-life-ink" : "bg-period-ink";
          return (
            <li key={r.name} className="grid gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center">
              <div>
                <span className="font-semibold">{r.name}</span>
                <span className="block text-sm text-muted">{detail(r.cover)}</span>
              </div>
              <div className="relative h-5" aria-hidden="true">
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
        })}
      </ul>
    </section>
  );
}
