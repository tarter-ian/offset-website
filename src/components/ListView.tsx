"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { badgesFor } from "@/lib/badges";
import type { ListItem } from "@/lib/publicList";
import { nameMatches, SEARCH_FROM } from "@/lib/publicList";
import { BadgeList } from "./Badge";
import { savedListing } from "./ListOptIn";

export interface ListRowData {
  id: string;
  name: string;
  badges: ListItem[];
}

/**
 * One person, one row (Ian, 2026-10-13): the name on the left, their badges as tags on the
 * right, wrapping under the name only on a narrow phone. No date: "since" didn't earn its place.
 * `you` marks this browser's own entry, with the way to change it.
 */
export function Row({ name, items, example, you }: { name: string; items: ListItem[]; example?: boolean; you?: boolean }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <span className="flex flex-wrap items-center gap-x-2">
          <span className={`font-display text-xl leading-8 font-semibold ${example ? "italic" : ""}`}>{name}</span>
          {you && (
            <span className="rounded-sm border-[1.5px] border-rule px-1.5 py-0.5 text-[11px] leading-none font-semibold tracking-wider uppercase">You</span>
          )}
        </span>
        {you && (
          <Link href="/list/edit" className="text-sm whitespace-nowrap underline underline-offset-4 hover:text-muted">
            Change name or leave
          </Link>
        )}
      </div>
      <div className="sm:flex sm:min-w-0 sm:justify-end">
        <BadgeList badges={badgesFor(items)} label={`${name}'s badges`} end />
      </div>
    </div>
  );
}

/**
 * Finds this browser's own entry from the edit token it kept when joining, the same lookup
 * /list/edit makes. Nothing else is sent: no amounts, no new id. Null when this browser didn't join.
 */
function useOwnId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const token = savedListing()?.token;
    if (!token) return;
    let live = true;
    fetch("/api/list/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { id?: unknown } | null) => {
        if (live && typeof d?.id === "string") setId(d.id);
      })
      .catch(() => {
        // Shown as everyone else, then.
      });
    return () => {
      live = false;
    };
  }, []);
  return id;
}

/**
 * The list's rows, already filtered by the server, with "Find a name" above the filters (`children`)
 * once the list is long enough, and this browser's own row pinned to the top. `fallback` stands in
 * for the rows when the list is empty, didn't load, or the filter finds nobody.
 */
export function ListView({ people, total, fallback, children }: { people: ListRowData[]; total: number; fallback?: ReactNode; children: ReactNode }) {
  const [query, setQuery] = useState("");
  const own = useOwnId();
  const searchable = total >= SEARCH_FROM;
  const found = searchable ? people.filter((p) => nameMatches(p.name, query)) : people;
  const mine = own ? found.find((p) => p.id === own) : undefined;
  const rows = mine ? [mine, ...found.filter((p) => p !== mine)] : found;

  // /list#you, from the record: the row arrives after the lookup, so scroll to it then.
  useEffect(() => {
    if (mine && window.location.hash === "#you") document.getElementById("you")?.scrollIntoView({ block: "center" });
  }, [mine]);

  return (
    <>
      {searchable && (
        <div className="mt-8">
          <label htmlFor="find-name" className="sr-only">
            Find a name
          </label>
          <input
            id="find-name"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a name"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-sm border-2 border-rule bg-background px-3 placeholder:text-muted sm:w-80"
          />
        </div>
      )}
      {children}
      {fallback ?? (
        <>
          <p role="status" className={rows.length ? "sr-only" : "mt-8 border-y-2 border-rule py-6"}>
            {query.trim() && (rows.length ? `${rows.length} ${rows.length === 1 ? "person" : "people"} found` : "No one by that name.")}
          </p>
          {rows.length > 0 && (
            <ul className="mt-8 divide-y divide-border border-y-2 border-rule">
              {rows.map((p) => (
                <li key={p.id} id={p === mine ? "you" : undefined} className={p === mine ? "scroll-mt-4" : undefined}>
                  <Row name={p.name} items={p.badges} you={p === mine} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
