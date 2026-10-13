import type { Metadata } from "next";
import Link from "next/link";
import { BadgeTag, FilterTag, Seal } from "@/components/Badge";
import { ListView, Row } from "@/components/ListView";
import { filterCounts, type ListFilter, type ListStatus, matches, PAST, parseFilter, REST, type Tone } from "@/lib/badges";
import { listedPeople, type ListedPerson } from "@/lib/listStore";
import { parseQuery } from "@/lib/publicList";
import { paymentsOn } from "@/lib/payments";
import { PRODUCTS, productById, SECTIONS } from "@/lib/store";

export const metadata: Metadata = {
  title: "The public list | My Offset",
  description: "People who chose to show what they've offset: a name they picked and their badges. No amounts.",
};
export const dynamic = "force-dynamic";

/**
 * The color chips. Green is past and future both paid, so it also shows under the other two (Ian, 2026-10-13).
 * "Future paid" is back (Ian, 2026-10-13): badges turn yellow once people stop paying, so blue is still
 * offsetting going forward.
 */
const STATUS_CHIPS: { status: ListStatus; tone: Tone; label: string }[] = [
  { status: "life", tone: "life", label: "For life" },
  { status: "future", tone: "period", label: "Future paid" },
  { status: "past", tone: "past", label: "Past paid" },
];

export default async function ListPage({ searchParams }: { searchParams: Promise<{ aisle?: string; item?: string; status?: string; q?: string | string[] }> }) {
  const params = await searchParams;
  const filter: ListFilter = parseFilter(params);
  let people: ListedPerson[] | null = null;
  try {
    people = await listedPeople();
  } catch {
    people = null;
  }
  const counts = filterCounts((people ?? []).map((p) => p.badges));
  const shown = people?.filter((p) => matches(p.badges, filter)) ?? [];
  const aisle = filter.kind === "aisle" ? filter.key : filter.kind === "item" ? productById(filter.key)?.section : undefined;
  const now = new Date();
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 1)).toISOString();
  const join = paymentsOn()
    ? "You join by ticking “List me publicly” when you give for your plan, or by adding yourself from a gift someone sent you."
    : "Joining opens when giving does. You’ll tick “List me publicly” at checkout; it’s off unless you do.";
  // What stands in for the rows: the list didn't load, nobody's on it yet, or the filter finds nobody.
  const fallback =
    people === null ? (
      <p className="mt-8 border-y-2 border-rule py-6">The list couldn&apos;t load just now. Try again in a minute.</p>
    ) : people.length === 0 ? (
      <section aria-labelledby="empty-heading" className="mt-8 border-y-2 border-rule py-6">
        <h2 id="empty-heading" className="text-xl font-semibold">
          Nobody is on the list yet.
        </h2>
        <p className="mt-1">{join}</p>
        <figure className="mt-6 border-2 border-dashed border-rule px-4">
          <figcaption className="-mx-4 border-b-2 border-dashed border-rule px-4 py-2 text-xs font-semibold tracking-wider uppercase">
            This is how you&apos;d appear
          </figcaption>
          <Row
            example
            name="Your name"
            items={[
              { productId: "ai", until: null, past: true },
              { productId: "ai-media", until: null, past: true },
              { productId: "ai-video", until: null, past: true },
              { productId: "ai-coding", until: null, past: true },
              { productId: "video", until: nextYear },
            ]}
          />
        </figure>
        <p className="mt-2 text-sm text-muted">An example of your own entry, not a real person. You pick the name; the badges come from what you offset.</p>
      </section>
    ) : shown.length === 0 ? (
      <p className="mt-8 border-y-2 border-rule py-6">Nobody here yet for this badge.</p>
    ) : null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">The public list</h1>
      <p className="mt-3 text-lg text-muted">
        People who chose to show what they&apos;ve offset, under a name or initials they picked. Each one is here only after Every.org confirmed every gift
        they made. No amounts, and anyone can leave anytime.
      </p>

      <ListView
        people={shown.map((p) => ({ id: p.id, name: p.name, badges: p.badges }))}
        total={people?.length ?? 0}
        fallback={fallback}
        initialQuery={parseQuery(params.q)}
        forms={["list-filter", "list-items"]}
      >
        <nav aria-label="Filter the list" className="mt-8">
          {/* The filter speaks the badges' language (Ian, 2026-10-13): tags in their colors, filled when chosen,
              in two labeled rows, status then badge. */}
          <form id="list-filter" action="/list" method="get" className="grid gap-x-3 gap-y-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-start">
            <h2 id="filter-status" className="text-sm font-semibold sm:leading-10">
              Status
            </h2>
            <div role="group" aria-labelledby="filter-status" className="flex flex-wrap gap-2">
            <FilterTag label="Everyone" on={filter.kind === "everyone"} count={people?.length || undefined} />
            {STATUS_CHIPS.map((c) => (
              <FilterTag
                key={c.status}
                kind="item"
                tone={c.tone}
                label={c.label}
                name="status"
                value={c.status}
                on={filter.kind === "status" && filter.status === c.status}
                count={counts[`status:${c.status}`] || undefined}
              />
            ))}
            </div>
            <h2 id="filter-badge" className="mt-2 text-sm font-semibold sm:mt-0 sm:leading-10">
              Badge
            </h2>
            <div role="group" aria-labelledby="filter-badge" className="flex flex-wrap gap-2">
            <FilterTag kind="full" label="Fully Offset" name="aisle" value="everything" on={filter.kind === "full"} count={counts.everything || undefined} />
            {SECTIONS.map((s) => (
              <FilterTag
                key={s.key}
                kind="aisle"
                icon={s.key}
                label={s.title}
                name="aisle"
                value={s.key}
                on={(filter.kind === "aisle" && filter.key === s.key) || (filter.kind === "item" && aisle === s.key)}
                count={counts[s.key] || undefined}
              />
            ))}
            </div>
          </form>
          {aisle && (
            <form id="list-items" action="/list" method="get" aria-label={`Items in ${SECTIONS.find((s) => s.key === aisle)?.title}`} className="mt-2 flex flex-wrap gap-2 border-l-2 border-rule pl-3 sm:ml-[4.75rem]">
              {PRODUCTS.filter((p) => p.section === aisle).map((p) => (
                <FilterTag
                  key={p.id}
                  kind="item"
                  label={p.name}
                  name="item"
                  value={p.id}
                  back={["aisle", aisle]}
                  on={filter.kind === "item" && filter.key === p.id}
                  count={counts[`item:${p.id}`] || undefined}
                />
              ))}
            </form>
          )}
        </nav>
      </ListView>

      <section aria-labelledby="badges-heading" className="mt-12">
        <h2 id="badges-heading" className="text-2xl font-bold">
          The badges
        </h2>
        <ul className="mt-4 grid gap-6 border-t-2 border-rule pt-5 sm:grid-cols-3">
          {[
            { seal: <Seal kind="full" name="Fully Offset" until={null} />, title: "Fully Offset", note: "Everything in the store, offset." },
            { seal: <Seal kind="aisle" name="AI" until={null} />, title: "An aisle", note: "Every item in it, like all of AI: chat, images, video and coding." },
            { seal: <Seal kind="item" name="Video streaming" until={nextYear} />, title: "One item", note: "Just that one, like video streaming." },
          ].map((b) => (
            <li key={b.title} className="flex items-start gap-4 sm:flex-col">
              {b.seal}
              <span>
                <span className="block font-semibold">{b.title}</span>
                <span className="block text-sm text-muted">{b.note}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* The term key (Ian, 2026-10-13): the color says what's paid, the edge says until when. */}
        <ul className="mt-6 space-y-2 text-sm">
          {[
            { until: null, name: "AI chat", note: "Past and future use, offset for life." },
            { until: nextYear, name: "Video streaming", note: "The future, being offset through a date." },
            { until: REST, name: "AI images", note: "The future, offset for the rest of life; past use not yet." },
            { until: PAST, name: "Car", note: "Past use, fully paid off." },
            { until: [PAST, nextYear], name: "Flights", note: "Past use paid off, with the future still being offset." },
          ].map((t) => (
            <li key={t.note} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <BadgeTag kind="item" name={t.name} until={t.until} />
              <span className="text-muted">{t.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Green replaces yellow and blue: a badge shows one color, or yellow and blue together. An aisle or Fully Offset is green
          only when every item in it is. Items someone uses none of, like AI video for someone who makes none, count as green. A badge whose date
          passes drops off the list unless past use was paid.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted">
        On the list? <Link href="/list/edit" className="underline">Change your name or leave</Link>, from the browser you joined on.
      </p>
    </div>
  );
}
