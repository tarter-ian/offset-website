"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { accountsOn, coversAll, mergeCovered } from "@/lib/account";
import { localCovered, pushCovered, setLocalCovered, signOut, startSignIn, verifySignIn } from "@/lib/accountClient";
import type { Covered } from "@/lib/covered";
import { productById } from "@/lib/store";
import { PAYMENT_MODE } from "@/lib/payments";

type Step =
  | { kind: "email" }
  | { kind: "code"; email: string }
  | { kind: "checking" }
  /** This browser covers things the account doesn't: ask before adding them, in case it's someone else's browser. */
  | { kind: "merge"; email: string; account: Record<string, Covered>; extra: string[] }
  | { kind: "done"; email: string };

const field = "min-h-11 w-full rounded-md border-2 border-rule bg-background px-3";
const primary = "min-h-11 cursor-pointer rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-60";

/** Where to go once signed in: the record, or straight back to deleting. */
const nextPath = (next: string | null) => (next === "delete" ? "/data#account" : "/record");

export function SignIn() {
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const tried = useRef(false);

  /** After a good code or link: bring the account's covers here, and ask before sending this browser's up. */
  function signedIn(addr: string, account: Record<string, Covered>, then: string | null) {
    const local = localCovered();
    const extra = Object.keys(local).filter((id) => !coversAll(account, { [id]: local[id] }));
    if (extra.length && Object.keys(account).length) {
      setStep({ kind: "merge", email: addr, account, extra });
      return;
    }
    const merged = mergeCovered(local, account);
    setLocalCovered(merged);
    void pushCovered(merged).finally(() => window.location.assign(nextPath(then)));
    setStep({ kind: "done", email: addr });
  }

  // Opening the emailed link signs in straight away.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const q = new URLSearchParams(window.location.search);
    setNext(q.get("next"));
    const e = q.get("email");
    const t = q.get("t");
    if (!e || !t) return;
    setEmail(e);
    setStep({ kind: "checking" });
    verifySignIn(e, { token: t }).then(({ ok, data }) => {
      if (ok) signedIn(String(data.email), (data.covered as Record<string, Covered>) ?? {}, q.get("next"));
      else {
        setError(String(data.error ?? "That link didn't work."));
        setStep({ kind: "email" });
      }
    });
  }, []);

  if (!accountsOn()) return <p className="mt-8">Accounts open soon. Until then, everything you do here is saved in this browser.</p>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await startSignIn(email);
    setBusy(false);
    if (ok) setStep({ kind: "code", email: email.trim() });
    else setError(String(data.error ?? "Something went wrong."));
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    setBusy(true);
    setError("");
    const { ok, data } = await verifySignIn(step.email, { code: code.trim() });
    setBusy(false);
    if (ok) signedIn(String(data.email), (data.covered as Record<string, Covered>) ?? {}, next);
    else setError(String(data.error ?? "That code didn't work."));
  }

  return (
    <div className="mt-8">
      {step.kind === "email" && (
        <form onSubmit={send} className="grid gap-3">
          <label htmlFor="signin-email" className="font-semibold">
            Your email
          </label>
          <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <p className="text-sm text-muted">
            {PAYMENT_MODE === "every" ? "Use the one you gave Every.org when you paid, and what you covered is already there." : "Use the one you give when you pay."}
          </p>
          <div>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </div>
        </form>
      )}

      {step.kind === "code" && (
        <form onSubmit={check} className="grid gap-3">
          <p>
            We sent a code to <b>{step.email}</b>. Type it here, or tap the link in the email.
          </p>
          <label htmlFor="signin-code" className="font-semibold">
            6-digit code
          </label>
          <input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${field} max-w-48 font-mono text-xl tracking-[0.3em]`}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy || code.length !== 6} className={primary}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button type="button" onClick={() => setStep({ kind: "email" })} className="min-h-10 cursor-pointer text-sm underline underline-offset-4 hover:text-muted">
              Use a different email
            </button>
          </div>
        </form>
      )}

      {step.kind === "checking" && <p className="text-muted">Signing you in…</p>}

      {step.kind === "merge" && (
        <div className="border-t-2 border-rule pt-4">
          <p className="font-semibold">This browser has covered items your account doesn&apos;t:</p>
          <p className="mt-1">{step.extra.map((id) => productById(id)?.name ?? id).join(", ")}</p>
          <p className="mt-2 text-sm text-muted">If this is your browser, add them. If it&apos;s someone else&apos;s, sign out and they stay theirs.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const merged = mergeCovered(localCovered(), step.account);
                setLocalCovered(merged);
                void pushCovered(merged).finally(() => window.location.assign(nextPath(next)));
                setStep({ kind: "done", email: step.email });
              }}
              className={primary}
            >
              Add them to my account
            </button>
            <button
              type="button"
              onClick={() => void signOut().finally(() => window.location.assign("/"))}
              className="min-h-11 cursor-pointer rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
            >
              Sign out instead
            </button>
          </div>
        </div>
      )}

      {step.kind === "done" && (
        <p>
          Signed in as <b>{step.email}</b>. <Link href={nextPath(next)} className="underline underline-offset-4">Continue</Link>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
