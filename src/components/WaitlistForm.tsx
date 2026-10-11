"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    if (res?.ok) {
      setState("done");
    } else {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="font-medium text-accent">You&apos;re on the list. We&apos;ll email you when accounts open.</p>;
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-lg border border-border bg-card px-3 py-2 outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {state === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      {state === "error" && <p className="text-sm text-red-600 sm:basis-full">{error}</p>}
    </form>
  );
}
