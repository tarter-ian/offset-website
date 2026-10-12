import type { Metadata } from "next";
import Link from "next/link";
import { listedPeople, type ListedPerson } from "@/lib/listStore";
import { productById, PRODUCTS } from "@/lib/store";

export const metadata: Metadata = {
  title: "The public list | My Offset",
  description: "People who chose to show what they've covered: their name, what they covered and since when. No amounts.",
};
export const dynamic = "force-dynamic";

const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default async function ListPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  let people: ListedPerson[] | null = null;
  try {
    people = await listedPeople();
  } catch {
    people = null;
  }
  const shown = people?.filter((p) => !item || p.badges.some((b) => b.productId === item)) ?? [];
  const items = PRODUCTS.filter((p) => people?.some((x) => x.badges.some((b) => b.productId === p.id)));
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">The public list</h1>
      <p className="mt-3 text-lg text-muted">
        People who chose to show what they&apos;ve covered. Each one is here only after Every.org confirmed every gift they made. No amounts, and anyone can
        leave anytime.
      </p>
      {items.length > 1 && (
        <nav aria-label="Filter by what's covered" className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/list" className={`rounded-md border-2 border-rule px-3 py-1.5 ${!item ? "bg-foreground text-background" : ""}`}>
            Everyone
          </Link>
          {items.map((p) => (
            <Link key={p.id} href={`/list?item=${p.id}`} className={`rounded-md border-2 border-rule px-3 py-1.5 ${item === p.id ? "bg-foreground text-background" : ""}`}>
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      {people === null ? (
        <p className="mt-8">The list couldn&apos;t load just now. Try again in a minute.</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 border-y-2 border-rule py-6">
          {item ? "Nobody here yet for this." : "Nobody is on the list yet."} You can join when you pay for your plan, by ticking &ldquo;List me publicly&rdquo;.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y-2 border-rule">
          {shown.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg font-semibold">{p.name}</span>
                <span className="text-sm text-muted">since {month(p.since)}</span>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {p.badges.map((b) => (
                  <li key={b.productId} className={`rounded-md px-2 py-1 ${b.until === null ? "bg-life text-life-ink" : "bg-period text-period-ink"}`}>
                    {productById(b.productId)?.name ?? b.productId} · {b.until === null ? "for life" : `through ${month(b.until)}`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">
        On the list? <Link href="/list/edit" className="underline">Change your name or leave</Link>, from the browser you joined on.
      </p>
    </main>
  );
}
