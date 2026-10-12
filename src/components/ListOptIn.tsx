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
            Off unless you tick it. The <Link href="/list" className="underline">public list</Link> shows the name you pick, what you&apos;ve covered and
            since when, never amounts. You can change your name or leave anytime.
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
