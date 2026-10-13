import type { Metadata } from "next";
import Link from "next/link";
import { BadgeTag, Seal } from "@/components/Badge";
import { badgesFor, filterCounts, type ListFilter, matches, parseFilter } from "@/lib/badges";
import { listedPeople, type ListedPerson } from "@/lib/listStore";
import { paymentsOn } from "@/lib/payments";
import { PRODUCTS, productById, SECTIONS } from "@/lib/store";

export const metadata: Metadata = {
  title: "The public list | My Offset",
  description: "People who chose to show what they've offset: a name they picked, their badges and since when. No amounts.",
};
export const dynamic = "force-dynamic";

const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

const chip = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-md border-2 border-rule px-3 ${on ? "bg-foreground text-background" : "hover:bg-card"}`;

function FilterLink({ href, on, label, count }: { href: string; on: boolean; label: string; count?: number }) {
  return (
    <Link href={href} className={chip(on)} aria-current={on ? "page" : undefined}>
      {label}
      {!!count && <span className={`amount text-xs ${on ? "" : "text-muted"}`}>{count}</span>}
    </Link>
  );
}

/** One person's row: the name, since when, and their badges as tags. */
function Row({ name, since, items, example }: { name: string; since: string; items: ListedPerson["badges"]; example?: boolean }) {
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-display text-xl font-semibold ${example ? "italic" : ""}`}>{name}</span>
        <span className="text-sm text-muted">since {month(since)}</span>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Badges">
        {badgesFor(items).map((b) => (
          <li key={b.key}>
            <BadgeTag kind={b.kind} name={b.name} until={b.until} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ListPage({ searchParams }: { searchParams: Promise<{ aisle?: string; item?: string }> }) {
  const filter: ListFilter = parseFilter(await searchParams);
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
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">The public list</h1>
      <p className="mt-3 text-lg text-muted">
        People who chose to show what they&apos;ve offset, under a name or initials they picked. Each one is here only after Every.org confirmed every gift
        they made. No amounts, and anyone can leave anytime.
      </p>

      <nav aria-label="Filter by badge" className="mt-8">
        <h2 className="text-sm font-semibold">Filter by badge</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <FilterLink href="/list" on={filter.kind === "everyone"} label="Everyone" count={people?.length} />
          <FilterLink href="/list?aisle=everything" on={filter.kind === "full"} label="Fully Offset" count={counts.everything} />
          {SECTIONS.map((s) => (
            <FilterLink key={s.key} href={`/list?aisle=${s.key}`} on={filter.kind === "aisle" && filter.key === s.key} label={s.title} count={counts[s.key]} />
          ))}
        </div>
        {aisle && (
          <div className="mt-2 flex flex-wrap gap-2 border-l-2 border-rule pl-3 text-sm">
            {PRODUCTS.filter((p) => p.section === aisle).map((p) => (
              <FilterLink
                key={p.id}
                href={filter.kind === "item" && filter.key === p.id ? `/list?aisle=${aisle}` : `/list?item=${p.id}`}
                on={filter.kind === "item" && filter.key === p.id}
                label={p.name}
                count={counts[`item:${p.id}`]}
              />
            ))}
          </div>
        )}
      </nav>

      {people === null ? (
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
              since={now.toISOString()}
              items={[
                { productId: "ai", until: null },
                { productId: "ai-media", until: null },
                { productId: "ai-video", until: null },
                { productId: "ai-coding", until: null },
                { productId: "video", until: nextYear },
              ]}
            />
          </figure>
          <p className="mt-2 text-sm text-muted">An example of your own entry, not a real person. You pick the name; the badges come from what you offset.</p>
        </section>
      ) : shown.length === 0 ? (
        <p className="mt-8 border-y-2 border-rule py-6">Nobody here yet for this badge.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y-2 border-rule">
          {shown.map((p) => (
            <li key={p.id}>
              <Row name={p.name} since={p.since} items={p.badges} />
            </li>
          ))}
        </ul>
      )}

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
        <p className="mt-5 text-sm text-muted">
          Green is for life. Blue runs through a date. Once that date passes, the badge turns yellow if past use was offset too, and drops off the
          list if not.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted">
        On the list? <Link href="/list/edit" className="underline">Change your name or leave</Link>, from the browser you joined on.
      </p>
    </div>
  );
}
