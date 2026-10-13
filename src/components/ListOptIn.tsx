"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LIST_NAME_MAX } from "@/lib/publicList";

// Opting in to the public list: off unless ticked, under a name the person picks.
// The edit token the server hands back is kept in this browser.

const KEY = "offset:list:v1";

export function savedListing(): { token: string; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

export function forgetListing() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing saved to forget.
  }
}

/** Sends a claim; resolves with an error message, or null once saved. */
export async function joinList(name: string, claim: Record<string, unknown>): Promise<string | null> {
  const saved = savedListing();
  try {
    const res = await fetch("/api/list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...claim, name, token: saved?.token }) });
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!res.ok || !data.token) return data.error ?? "Couldn't add you to the list.";
    try {
      localStorage.setItem(KEY, JSON.stringify({ token: data.token, name }));
    } catch {
      return "Added, but this browser won't keep the link to change or leave it.";
    }
    return null;
  } catch {
    return "Couldn't reach the site. Try again.";
  }
}

/** The checkbox and name field. `onChange` gets the name when ticked, or null. */
export function ListOptIn({ label, onChange }: { label: string; onChange: (name: string | null) => void }) {
  const [on, setOn] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => setName(savedListing()?.name ?? ""), []);
  useEffect(() => onChange(on && name.trim() ? name.trim() : null), [on, name, onChange]);
  return (
    <div className="mt-3 text-sm">
      <label className="flex min-h-10 cursor-pointer items-start gap-2">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--accent)]" />
        <span>
          <span className="font-medium">{label}</span>
          <span className="block text-muted">
            Off unless you tick it. The <Link href="/list" className="underline">public list</Link> shows the name you pick, the badges for what you&apos;ve offset
            and since when, never amounts. You can change your name or leave anytime.
          </span>
        </span>
      </label>
      {on && (
        <input
          type="text"
          value={name}
          maxLength={LIST_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="A name or initials"
          aria-label="Name on the public list"
          className="ml-6 mt-1 min-h-10 w-64 max-w-[calc(100%-1.5rem)] rounded-md border-2 border-rule bg-background px-3"
        />
      )}
    </div>
  );
}

/**
 * After giving (Ian, 2026-10-13): one quiet line for anyone not on the public list,
 * which opens a name field only when asked. Someone already on it gets the change-or-leave link.
 * Without `join` (a gift's giver, who isn't the one listed) it only says how to join.
 */
export function ListInvite({ join, what }: { join?: (name: string) => Promise<string | null>; what?: string }) {
  const [listing, setListing] = useState<{ name: string } | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setListing(savedListing()), []);
  if (listing === undefined) return null;
  const send = async (n: string) => {
    if (!join) return;
    setBusy(true);
    const err = await join(n);
    setBusy(false);
    setNote(err ?? `You'll show on the public list as ${n} once Every.org confirms every gift.`);
  };
  const edit = (
    <Link href="/list/edit" className="underline">
      Change or leave
    </Link>
  );
  if (note)
    return (
      <p role="status" className="mt-3 text-sm">
        {note} {edit}
      </p>
    );
  if (listing)
    return (
      <p className="mt-3 text-sm text-muted">
        You&apos;re on the <Link href="/list" className="underline">public list</Link> as {listing.name}.{" "}
        {join && what && (
          <>
            <button type="button" disabled={busy} onClick={() => send(listing.name)} className="cursor-pointer underline hover:text-foreground">
              Add {what} to it
            </button>{" "}
            or{" "}
          </>
        )}
        <Link href="/list/edit" className="underline">
          {join && what ? "change or leave" : "Change or leave"}
        </Link>
        .
      </p>
    );
  if (!join)
    return (
      <p className="mt-3 text-sm text-muted">
        You can join the <Link href="/list" className="underline">public list</Link> when you give for your own plan. It shows a name you pick and badges, never
        amounts.
      </p>
    );
  if (!open)
    return (
      <p className="mt-3 text-sm text-muted">
        Want to show on the <Link href="/list" className="underline">public list</Link>?{" "}
        <button type="button" onClick={() => setOpen(true)} className="cursor-pointer font-medium text-foreground underline">
          Join it
        </button>{" "}
        under a name or initials you pick. It shows badges, never amounts, and you can leave anytime.
      </p>
    );
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void send(name.trim());
      }}
    >
      <input
        type="text"
        value={name}
        maxLength={LIST_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder="A name or initials"
        aria-label="Name on the public list"
        className="min-h-10 w-64 max-w-full rounded-md border-2 border-rule bg-background px-3"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 font-semibold hover:bg-foreground hover:text-background disabled:cursor-default disabled:opacity-60"
      >
        Add me
      </button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-10 cursor-pointer px-2 text-muted underline hover:text-foreground">
        Not now
      </button>
    </form>
  );
}
