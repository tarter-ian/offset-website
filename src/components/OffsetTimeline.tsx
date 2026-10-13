"use client";

import { useId, useState } from "react";
import { termPhrase } from "@/lib/badges";
import type { Covered } from "@/lib/covered";
import { productById, SECTIONS } from "@/lib/store";

// What's offset, as a timeline (Ian, 2026-10-13): one row per aisle when everything in it was
// paid the same way, else one per item. Left of today is past use, right is what's offset ahead:
// the next year to scale, then the rest of life.
//
// Someone with a lot offset sees the first three rows and a "Show all" to open the rest in place
// (Ian, 2026-10-13). Fully Offset gets the same rows, with a few words beside the heading.
// The record page draws the same timeline with every row out and no heading of its own (Ian, 2026-10-13).

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
  const key = (c: Covered) =>
    `${c.kind}|${c.kind === "period" ? c.until.slice(0, 10) : ""}|${c.past ?? ""}|${c.giftFrom ?? ""}|${c.kind === "period" ? (c.autopay ?? "") : ""}`;
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

const ended = (c: Covered, now: number) => c.kind === "period" && Date.parse(c.until) <= now;

function detail(c: Covered, now: number): string {
  const past = c.past ? ", past use included" : ", no past use";
  const what =
    c.kind === "life"
      ? c.past === false
        ? "All future use"
        : `For life${past}`
      : ended(c, now)
        ? `Ended ${day(c.until)}${past}`
        : c.autopay && !c.giftFrom
          ? `Repeats on Every.org, next ${day(c.until)}${past}`
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
  const life = r.cover.kind === "life";
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center">
      <span className="font-semibold">{r.name}</span>
      {/* The term is said only to screen readers; the bar and the dated axis show it (Ian, 2026-10-13). */}
      <div className="relative h-5" role="img" aria-label={detail(r.cover, now)}>
        <span className="absolute top-1/2 right-0 h-px bg-border" style={{ left: `${TODAY}%` }} />
        {/* Paid past use runs from the left edge in the muted hue; none paid leaves a dashed line, so the gap reads as chosen (Ian, 2026-10-13). */}
        {r.cover.past ? (
          <span className={`absolute top-1 bottom-1 left-0 rounded-l-sm ${life ? "bg-life-past" : "bg-period-past"}`} style={{ width: `${TODAY}%` }} />
        ) : (
          <span className="absolute top-1/2 left-0 border-t border-dashed border-muted" style={{ width: `${TODAY}%` }} />
        )}
        {!ended(r.cover, now) && (
          <span
            className={`absolute top-1 bottom-1 ${life ? "" : "rounded-r-sm"} ${life ? "bg-life-ink" : "bg-period-ink"}`}
            style={{ left: `${TODAY}%`, width: `${endAt(r.cover, now) - TODAY}%` }}
          />
        )}
        <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground" style={{ left: `${TODAY}%` }} />
      </div>
    </li>
  );
}

/**
 * `full` is the Fully Offset badges' terms, when the person is Fully Offset, for the note by the heading.
 * `heading` false leaves the heading to the page around it; `fold` false shows every row (the record page).
 */
export function OffsetTimeline({
  covered,
  full = [],
  heading = true,
  fold = true,
  now = Date.now(),
}: {
  covered: Record<string, Covered>;
  full?: (string | null)[];
  heading?: boolean;
  fold?: boolean;
  now?: number;
}) {
  const [open, setOpen] = useState(false);
  const restId = useId();
  const all = rows(covered);
  if (!all.length) return null;
  const shown = fold ? all.slice(0, FIRST) : all;
  const rest = fold ? all.slice(FIRST) : [];
  // Real dates where they're exact; the far end stays words (Ian, 2026-10-13).
  const inAYear = new Date(now + 365.25 * 86400000).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <section aria-labelledby={heading ? "offset-timeline-heading" : undefined}>
      {heading && (
        // The paid hero's headline (Ian, 2026-10-13).
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 id="offset-timeline-heading" className="font-display text-2xl font-semibold">
            What you&apos;ve offset
          </h1>
          {full.length > 0 && <p className="text-sm font-semibold">Fully Offset {termPhrase(full)}</p>}
        </div>
      )}
      {/* Rows start in different years, so the left end says what it is, not a year (Ian, 2026-10-13). */}
      <div className="mt-3 grid text-xs text-muted sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-x-4" aria-hidden="true">
        <span className="hidden sm:block" />
        <div className="relative h-4">
          <span className="absolute left-0">Past use</span>
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
      {/* The toggle sits under the last row, so opening it reads top to bottom (Ian, 2026-10-13). */}
      {rest.length > 0 && (
        <>
          <ul id={restId} hidden={!open} aria-label="The rest of what you've offset">
            {rest.map((r) => (
              <Line key={r.name} row={r} now={now} />
            ))}
          </ul>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={restId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-10 cursor-pointer items-center text-sm underline underline-offset-4 hover:text-muted"
          >
            {open ? "Show fewer" : `Show all ${all.length}`}
          </button>
        </>
      )}
    </section>
  );
}
