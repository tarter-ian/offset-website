"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Covered, STORAGE_KEY } from "@/lib/covered";
import { AccountBar } from "./Account";
import { Seal } from "./Badge";
import { badgesFor, fullBadge, offsetItems, toOffset } from "@/lib/badges";
import { accountsOn } from "@/lib/account";
import { fetchAccount, pullCovered, pushCovered } from "@/lib/accountClient";
import { canInstallExtension, savedResults } from "@/lib/extension";
import { AI_CHAT_SERVICES, type AiChatService, inForce, monthlyUse, monthTotal, type MonthUse, offsetCount, onAutopay, recordStatus } from "@/lib/record";
import { loadCheckout, PAYMENT_MODE } from "@/lib/payments";
import { itemName } from "@/lib/reminders";
import { type SteadyPlan, steadyIds, steadyPlan } from "@/lib/steady";
import { SteadyCheck } from "./SteadyCheck";
import { type Context, DEFAULT_CONTEXT, productById } from "@/lib/store";

// The page a returning visitor lands on: whether anything needs doing, their AI
// use month by month (read from the extension on this computer, never sent to
// us), and what's offset over time.

const EVERY_GIVING = "https://www.every.org/my-giving";
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

/** The items there's something to offset at this browser's saved amounts, for Fully Offset. Amounts stay in the browser. */
function loadNeeded(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { amounts?: Record<string, number | string>; ctx?: Partial<Context> };
    return toOffset(s.amounts ?? {}, { ...DEFAULT_CONTEXT, ...s.ctx });
  } catch {
    return toOffset({}, DEFAULT_CONTEXT);
  }
}

/**
 * Marks what a steady gift from this browser's checkout pays for as on autopay, for checkouts
 * saved before covers kept the flag, so every part of the page reads autopay the same way.
 */
function withSteady(covered: Record<string, Covered>, steady: SteadyPlan | null): Record<string, Covered> {
  const ids = steadyIds(steady);
  if (!steady || !ids.length) return covered;
  return Object.fromEntries(
    Object.entries(covered).map(([id, c]) => [id, c.kind === "period" && !c.giftFrom && !c.autopay && ids.includes(id) ? { ...c, autopay: steady.billing } : c]),
  );
}

export function Record() {
  const [saved, setCovered] = useState<Record<string, Covered> | null>(null);
  const [use, setUse] = useState<MonthUse[] | null>(null);
  const [computer, setComputer] = useState(true);
  const [steady, setSteady] = useState<SteadyPlan | null>(null);
  const [needed, setNeeded] = useState<string[]>([]);
  /** Signed in with reminders on: only then does a link come by email. */
  const [reminded, setReminded] = useState(false);

  useEffect(() => {
    setCovered(loadCovered());
    setSteady(steadyPlan(loadCheckout()));
    setNeeded(loadNeeded());
    setComputer(canInstallExtension());
    fetchAccount().then((a) => setReminded(a.signedIn && a.reminders !== false));
    // Signed in: bring in what the account covers (from another device), then send up anything this browser adds.
    pullCovered().then((merged) => {
      if (merged) {
        setCovered(merged);
        void pushCovered(merged);
      }
    });
    savedResults().then((r) => setUse(monthlyUse(Object.fromEntries(AI_CHAT_SERVICES.map((s) => [s, r[s]?.record])))));
  }, []);

  if (!saved) return <p className="py-16 text-muted">Loading your record…</p>;
  const now = Date.now();
  // Items on Every.org's autopay renew there, so they never come due here (Ian, 2026-10-13).
  const covered = withSteady(saved, steady);
  const status = recordStatus(covered, now);
  // Count what's offset against every item there's something to offset, so one item for life
  // never reads as done (Ian, 2026-10-13), and an item at nothing never stands in the way.
  const { offset, open } = offsetCount(covered, needed, now);
  const all = open === 0;
  const full = all ? fullBadge(covered, needed, now) : null;
  const subject = offset.length === 1 ? `${nameOf(offset[0])} is` : `${offset.length} things are`;
  const more = open > 0 && <> {open} more {open === 1 ? "thing" : "things"} you could offset.</>;

  return (
    <div className="pb-20">
      <section className="pt-10 pb-2 lg:pt-14">
        {status.kind === "due" ? (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">Welcome back.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              Your {list(status.ids.map(itemName))} ran through {day(status.ended)}. The next stretch is ready when you are.
            </p>
            <div className="mt-6 grid max-w-2xl gap-4 border-t-2 border-b border-t-rule border-b-border py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <p>Priced from your latest counts, card fees included. You see the amount before anything is charged.</p>
              <Link
                href={`/?store=1&renew=${encodeURIComponent(status.ids.join(","))}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
              >
                Offset the next month
              </Link>
            </div>
          </>
        ) : status.kind === "none" ? (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">Nothing offset yet.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">Once you offset something, it shows up here with the date it started.</p>
            <p className="mt-6">
              <Link href="/?store=1" className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong">
                See your AI use
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              {/* The badge the store promises, once everything is offset (Ian, 2026-10-13). */}
              {full && <Seal kind="full" name={full.name} until={full.until} size={112} />}
              <h1 className="font-display text-4xl leading-[1.05] font-extrabold [font-stretch:85%] sm:text-5xl">
                {all ? "You're fully offset." : `${subject} offset${status.kind === "life" ? " for life" : ""}.`}
              </h1>
            </div>
            <p className="mt-4 max-w-xl text-lg text-muted">
              {status.kind === "life" ? (
                all ? (
                  "Everything is offset for life. There's nothing more to do."
                ) : (
                  more
                )
              ) : status.kind === "steady" ? (
                <>
                  Your steady gift repeats on its own through Every.org until you stop it there.{more}
                </>
              ) : (
                <>
                  Nothing due until {day(status.until)}.{" "}
                  {reminded ? (
                    "We'll send you a link then."
                  ) : accountsOn() ? (
                    <Link href="/signin" className="underline underline-offset-4 hover:text-foreground">
                      Sign in to get a reminder.
                    </Link>
                  ) : null}
                  {more}
                </>
              )}
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
        <UseChart use={use} computer={computer} />
        {computer && (
          <p className="mt-3 max-w-2xl text-sm text-muted">
            These counts stay on this computer, in the My Offset extension. We never receive them, so another computer or your phone won&apos;t show them.
          </p>
        )}
      </section>

      <section aria-labelledby="covered-heading" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="covered-heading" className="text-2xl font-bold">
            What&apos;s offset
          </h2>
          <Link href="/?store=1" className="text-sm underline underline-offset-4 hover:text-muted">
            Offset something else
          </Link>
        </div>
        <Seals covered={covered} now={now} needed={needed} />
        <CoveredList covered={covered} now={now} />
      </section>

      <SteadyCheck plan={steady} use={use} />

      <section aria-labelledby="more-heading" className="mt-12">
        <h2 id="more-heading" className="text-2xl font-bold">
          Other things you can do
        </h2>
        <ul className="mt-3 grid border-t border-rule sm:grid-cols-3">
          {[
            ["/gift", "Give an offset as a gift", "For a year or for life, with a link to send."],
            ["/ledger", "Where the money goes", "Every charity, and what each gift pays for."],
            // Repeating gifts are stopped in the person's Every.org account, not here (Ian, 2026-10-13).
            ...(PAYMENT_MODE === "every" ? [[EVERY_GIVING, "Manage repeating gifts", "Stop or change autopay on Every.org."]] : []),
            ["/data", "See or clear your data", "What this browser and your account keep, and how to clear it."],
          ].map(([href, title, note]) => {
            const inner = (
              <>
                <span className="font-semibold underline underline-offset-4 group-hover:text-accent">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{note}</span>
              </>
            );
            return (
              <li key={href} className="border-b border-border py-3 pr-4">
                {href.startsWith("http") ? (
                  <a href={href} target="_blank" rel="noreferrer" className="group block">
                    {inner}
                  </a>
                ) : (
                  <Link href={href} className="group block">
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <AccountBar />
    </div>
  );
}

function UseChart({ use, computer }: { use: MonthUse[] | null; computer: boolean }) {
  if (!computer && !use?.length)
    return (
      <p className="mt-4 max-w-2xl">
        Your monthly counts stay on the computer you measure with, so they show there, not here. We never receive them.
      </p>
    );
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

/**
 * The badges what's in force earns, plus past use paid for on a cover that has ended: the same
 * seals the public list and gift cards show. Fully Offset shows at the top of the page instead.
 */
function Seals({ covered, now, needed }: { covered: Record<string, Covered>; now: number; needed: string[] }) {
  const seals = badgesFor(offsetItems(covered, now), needed).filter((b) => b.kind !== "full");
  if (!seals.length) return null;
  return (
    <div className="mt-4 mb-2 flex flex-wrap gap-3">
      {seals.map((b) => (
        <Seal key={b.key} kind={b.kind} name={b.name} until={b.until} size={104} />
      ))}
    </div>
  );
}

/** Each offset item with a line over the last twelve months and the next: green for life, blue for a set stretch. */
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
        const steady = onAutopay(c);
        const live = steady || inForce(c, now);
        const start = c.since ? Date.parse(c.since) : from;
        const end = c.kind === "life" || steady ? from + span : Date.parse(c.until);
        const state = steady
          ? `Repeats through Every.org${c.since ? `, since ${monthYear(c.since)}` : ""}`
          : c.kind === "life"
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
