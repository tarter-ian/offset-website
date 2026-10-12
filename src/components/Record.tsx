"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import { savedResults } from "@/lib/extension";
import { AI_CHAT_SERVICES, type AiChatService, inForce, monthlyUse, monthTotal, type MonthUse, recordStatus } from "@/lib/record";
import { productById } from "@/lib/store";

// The page a returning visitor lands on: whether anything needs doing, their AI
// use month by month (read from the extension on this computer, never sent to
// us), and what's covered over time.

const NAMES: Record<AiChatService, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };
const SHADE: Record<AiChatService, string> = { chatgpt: "bg-accent", claude: "bg-period-ink", gemini: "bg-muted" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const monthShort = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const nameOf = (id: string) => productById(id)?.name ?? id;
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

function loadCovered(): Record<string, Covered> {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { covered?: Record<string, Covered> };
    return s.covered ?? {};
  } catch {
    return {};
  }
}

export function Record() {
  const [covered, setCovered] = useState<Record<string, Covered> | null>(null);
  const [use, setUse] = useState<MonthUse[] | null>(null);

  useEffect(() => {
    setCovered(loadCovered());
    savedResults().then((r) => setUse(monthlyUse(Object.fromEntries(AI_CHAT_SERVICES.map((s) => [s, r[s]?.record])))));
  }, []);

  if (!covered) return <p className="py-16 text-muted">Loading your record…</p>;
  const now = Date.now();
  const status = recordStatus(covered, now);

  return (
    <div className="pb-20">
      <section className="pt-10 pb-2 lg:pt-14">
        {status.kind === "due" ? (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">Welcome back.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              Your {list(status.ids.map((id) => nameOf(id).toLowerCase()))} ran through {day(status.ended)}. The next stretch is ready when you are.
            </p>
            <div className="mt-6 grid max-w-2xl gap-4 border-t-2 border-b border-t-rule border-b-border py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <p>Priced from your latest counts, card fees included. You see the amount before anything is charged.</p>
              <Link
                href={`/?store=1&renew=${encodeURIComponent(status.ids.join(","))}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
              >
                Cover the next month
              </Link>
            </div>
          </>
        ) : status.kind === "none" ? (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">Nothing covered yet.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">Once you cover something, it shows up here with the date it started.</p>
            <p className="mt-6">
              <Link href="/?store=1" className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong">
                See your AI use
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">You&apos;re covered.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              {status.kind === "life"
                ? "Everything here is covered for life. There's nothing more to do."
                : `Nothing to do until ${day(status.until)}. We'll send you a link then.`}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="use-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="use-heading" className="text-2xl font-bold">
            Your AI use, month by month
          </h2>
          <Link href="/?store=1" className="text-sm underline underline-offset-4 hover:text-muted">
            Count again
          </Link>
        </div>
        <UseChart use={use} />
        <p className="mt-3 max-w-2xl text-sm text-muted">
          These counts stay on this computer, in the My Offset extension. We never receive them, so another computer or your phone won&apos;t show them.
        </p>
      </section>

      <section aria-labelledby="covered-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="covered-heading" className="text-2xl font-bold">
            What&apos;s covered
          </h2>
          <Link href="/?store=1" className="text-sm underline underline-offset-4 hover:text-muted">
            Cover something else
          </Link>
        </div>
        <CoveredList covered={covered} now={now} />
      </section>

      <section aria-labelledby="more-heading" className="mt-12">
        <h2 id="more-heading" className="text-2xl font-bold">
          Other things you can do
        </h2>
        <ul className="mt-3 grid border-t border-rule sm:grid-cols-3">
          {[
            ["/gift", "Give one to someone", "Cover a friend's AI use for a year or for life."],
            ["/ledger", "Where the money goes", "Every charity, and what each gift pays for."],
            ["/data", "Stop or clear", "Ends anything repeating. What you covered stays covered."],
          ].map(([href, title, note]) => (
            <li key={href} className="border-b border-border py-3 pr-4">
              <Link href={href} className="group block">
                <span className="font-semibold underline underline-offset-4 group-hover:text-accent">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UseChart({ use }: { use: MonthUse[] | null }) {
  if (!use) return <p className="mt-4 text-muted">Looking for your counts on this computer…</p>;
  if (!use.length)
    return (
      <p className="mt-4 max-w-2xl">
        No counts on this computer yet.{" "}
        <Link href="/?store=1" className="font-semibold underline underline-offset-4 hover:text-muted">
          Count your real use
        </Link>{" "}
        with the extension, and each month you count adds a bar here.
      </p>
    );
  const max = Math.max(...use.map(monthTotal), 1);
  const last = use[use.length - 1];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const partial = last.month === thisMonth;
  // A month still under way isn't compared with a whole one; compare the last two whole months instead.
  const whole = use.filter((m) => m.month !== thisMonth);
  const [a, b] = whole.slice(-2);
  const change = a && b && monthTotal(a) > 0 ? Math.round(((monthTotal(b) - monthTotal(a)) / monthTotal(a)) * 100) : null;
  const services = AI_CHAT_SERVICES.filter((s) => use.some((m) => m.prompts[s] > 0));
  return (
    <>
      <p className="mt-2">
        {partial ? "This month so far" : monthShort(last.month)}: <b className="amount">{monthTotal(last).toLocaleString()} prompts</b>
        {partial && <span className="text-muted"> over {last.daysCounted} days</span>}.
        {change !== null && b && (
          <span className="text-muted">
            {" "}
            {monthShort(b.month)} was {change === 0 ? "the same as" : `${change > 0 ? "up" : "down"} ${Math.abs(change)}% on`} {monthShort(a.month)}.
          </span>
        )}
      </p>
      <div
        role="img"
        aria-label={`Prompts per month: ${use.map((m) => `${monthShort(m.month)} ${monthTotal(m)}`).join(", ")}.`}
        className="mt-4 grid h-40 items-end gap-2 border-b border-rule"
        style={{ gridTemplateColumns: `repeat(${use.length}, minmax(0, 1fr))` }}
      >
        {use.map((m, i) => (
          <div
            key={m.month}
            className={`flex flex-col-reverse overflow-hidden rounded-t-sm ${i === use.length - 1 ? "" : "opacity-60"}`}
            style={{ height: `${(monthTotal(m) / max) * 100}%` }}
          >
            {services.map((s) => (
              <span key={s} className={`block ${SHADE[s]}`} style={{ height: `${(m.prompts[s] / Math.max(monthTotal(m), 1)) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 grid gap-2 font-mono text-xs text-muted" style={{ gridTemplateColumns: `repeat(${use.length}, minmax(0, 1fr))` }}>
        {use.map((m) => (
          <span key={m.month} className="text-center">
            {monthShort(m.month)}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {services.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded-sm ${SHADE[s]}`} aria-hidden="true" />
            {NAMES[s]} <span className="amount text-muted">{last.prompts[s].toLocaleString()}</span>
          </span>
        ))}
      </p>
    </>
  );
}

/** Each covered item with a line over the last twelve months and the next: green for life, blue for a set stretch. */
function CoveredList({ covered, now }: { covered: Record<string, Covered>; now: number }) {
  const entries = Object.entries(covered).sort(([, a], [, b]) => (a.kind === b.kind ? 0 : a.kind === "life" ? -1 : 1));
  if (!entries.length) return <p className="mt-3 text-muted">Nothing yet.</p>;
  const year = 365.25 * 86400000;
  const from = now - year;
  const span = 2 * year;
  const at = (t: number) => `${Math.min(100, Math.max(0, ((t - from) / span) * 100))}%`;
  return (
    <ul className="mt-3 border-t border-rule">
      {entries.map(([id, c]) => {
        const live = inForce(c, now);
        const start = c.since ? Date.parse(c.since) : from;
        const end = c.kind === "life" ? from + span : Date.parse(c.until);
        const state =
          c.kind === "life"
            ? `For life${c.since ? `, since ${monthYear(c.since)}` : ""}`
            : live
              ? `Through ${day(c.until)}${c.since ? `, since ${monthYear(c.since)}` : ""}`
              : `Ended ${day(c.until)}`;
        return (
          <li key={id} className="grid gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
            <div>
              <span className="font-semibold">{nameOf(id)}</span>
              <span className="block text-sm text-muted">
                {state}
                {c.giftFrom ? ` · a gift from ${c.giftFrom}` : ""}
              </span>
            </div>
            <div className="relative h-5" aria-hidden="true">
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span
                className={`absolute top-1 bottom-1 rounded-sm ${c.kind === "life" ? "bg-life" : live ? "bg-period" : "bg-border"}`}
                style={{ left: at(start), width: `calc(${at(end)} - ${at(start)})` }}
              />
              <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground" style={{ left: at(now) }} title="Today" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
