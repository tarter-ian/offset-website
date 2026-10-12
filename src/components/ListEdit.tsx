"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productById } from "@/lib/store";
import { LIST_NAME_MAX } from "@/lib/publicList";
import { forgetListing, savedListing } from "./ListOptIn";

type Listing = { name: string; claims: { items: { productId: string; until: string | null }[]; createdAt: string; paid: boolean }[] };

const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** Renaming or leaving the public list, with the edit token this browser kept when joining. */
export function ListEdit() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [left, setLeft] = useState(false);

  useEffect(() => {
    const t = savedListing()?.token ?? null;
    setToken(t);
    if (!t) return;
    fetch("/api/list/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Listing | null) => {
        setListing(d);
        if (d) setName(d.name);
      })
      .catch(() => setNote("Couldn't load your listing."));
  }, []);

  const send = (method: "PATCH" | "DELETE", body: Record<string, unknown>) =>
    fetch("/api/list/me", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ...body }) }).then((r) => r.ok);

  if (token === undefined || (token && listing === undefined && !note)) return null;
  if (left) return <p className="mt-6">You&apos;re off the list, and what it held about you is deleted.</p>;
  if (!token || (!listing && !note))
    return (
      <p className="mt-6">
        This browser isn&apos;t on the <Link href="/list" className="underline">public list</Link>. You join it when you pay, by ticking &ldquo;List me
        publicly&rdquo;. If you joined in another browser, open this page there.
      </p>
    );
  return (
    <div className="mt-6 space-y-6">
      {listing && (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNote((await send("PATCH", { name })) ? "Saved." : "Couldn't save that name.");
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <label className="w-full font-semibold" htmlFor="list-name">
              Your name on the list
            </label>
            <input
              id="list-name"
              type="text"
              value={name}
              maxLength={LIST_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className="min-h-10 w-64 rounded-md border-2 border-rule bg-background px-3"
            />
            <button type="submit" className="min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 font-semibold hover:bg-foreground hover:text-background">
              Save
            </button>
          </form>
          <div>
            <h2 className="font-semibold">What it shows</h2>
            <ul className="mt-2 divide-y divide-border border-y-2 border-rule text-sm">
              {listing.claims.map((c, i) => (
                <li key={i} className="py-2">
                  {c.items.map((x) => `${productById(x.productId)?.name ?? x.productId} ${x.until === null ? "for life" : `through ${month(x.until)}`}`).join(", ")}
                  <span className="text-muted"> · {c.paid ? `from ${month(c.createdAt)}` : "shows once Every.org confirms every gift"}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Leave the public list? Your name and what it showed are deleted.")) return;
              if (await send("DELETE", {})) {
                forgetListing();
                setLeft(true);
              } else setNote("Couldn't remove you. Try again.");
            }}
            className="min-h-10 cursor-pointer rounded-md border-2 border-rule px-3 font-semibold hover:bg-foreground hover:text-background"
          >
            Leave the list
          </button>
        </>
      )}
      {note && <p role="status" className="text-sm">{note}</p>}
    </div>
  );
}
