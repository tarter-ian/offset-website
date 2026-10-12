"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountsOn } from "@/lib/account";
import { type AccountState, deleteAccount, fetchAccount, signOut } from "@/lib/accountClient";

/** "Signed in as …" with Sign out, or an offer to sign in. Nothing while accounts are off. */
export function AccountBar() {
  const [a, setA] = useState<AccountState | null>(null);
  useEffect(() => {
    fetchAccount().then(setA);
  }, []);
  if (!accountsOn() || !a) return null;
  return (
    <p className="mt-10 border-t border-border pt-3 text-sm text-muted">
      {a.signedIn ? (
        <>
          Signed in as <span className="text-foreground">{a.email}</span>.{" "}
          <button
            type="button"
            onClick={() => void signOut().finally(() => window.location.reload())}
            className="min-h-10 cursor-pointer underline underline-offset-4 hover:text-foreground"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          Want this on your phone or another computer?{" "}
          <Link href="/signin" className="font-semibold text-foreground underline underline-offset-4">
            Sign in with your email
          </Link>
          . Only what you&apos;ve covered goes with you, never your use.
        </>
      )}
    </p>
  );
}

/** The header's link: Sign in, or Your record once signed in. */
export function AccountNav() {
  const [a, setA] = useState<AccountState | null>(null);
  useEffect(() => {
    fetchAccount().then(setA);
  }, []);
  if (!accountsOn() || !a) return null;
  return (
    <Link href={a.signedIn ? "/record" : "/signin"} className="text-muted hover:text-foreground">
      {a.signedIn ? "Your record" : "Sign in"}
    </Link>
  );
}

/** Deleting the account from the data page: on-page confirm when the sign-in is recent, else an emailed link first. */
export function AccountDelete() {
  const [a, setA] = useState<AccountState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string>("");
  useEffect(() => {
    fetchAccount().then(setA);
  }, []);
  if (!accountsOn() || !a?.signedIn) return null;

  async function run() {
    const r = await deleteAccount();
    setConfirming(false);
    if (r.deleted) setResult("Deleted. We've emailed you to say so. This browser still has its own copy of your plan until you clear it.");
    else if (r.emailed) setResult(`To make sure it's you, we've emailed ${a!.email} a link. Open it, then delete from here.`);
    else setResult(r.error ?? "Something went wrong.");
  }

  return (
    <div id="account" className="scroll-mt-16 border-2 border-rule p-4">
      <p className="font-display text-lg font-bold">Delete my account</p>
      <p className="mt-1 text-sm text-muted">
        Removes your email and what you&apos;ve covered from our server. Your gifts stay with the charities, without your name.
      </p>
      {result ? (
        <p className="mt-3 text-sm" role="status">
          {result}
        </p>
      ) : confirming ? (
        <div className="mt-3" role="alertdialog" aria-labelledby="delete-confirm">
          <p id="delete-confirm" className="text-sm font-semibold">
            Delete the account for {a.email} for good? This can&apos;t be undone.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={run} autoFocus className="min-h-11 cursor-pointer rounded-md border-2 border-danger bg-danger px-4 font-semibold text-on-accent hover:opacity-90">
              Yes, delete it
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 cursor-pointer rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (a.fresh ? setConfirming(true) : run())}
          className="mt-3 min-h-11 cursor-pointer rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
        >
          {a.fresh ? "Delete my account" : "Email me a link to delete it"}
        </button>
      )}
    </div>
  );
}
