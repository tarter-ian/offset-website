"use client";

import { useState } from "react";
import { forgetExtensionData } from "@/lib/extension";

// Everything the site keeps in this browser. Add new keys here when the site starts saving more.
const BROWSER_KEYS = ["offset:plan:v2", "offset:answers"];

/** Buttons to clear what this browser saved and to take an email off the waitlist. */
export function DataControls() {
  const [cleared, setCleared] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function clearBrowser() {
    try {
      for (const k of BROWSER_KEYS) localStorage.removeItem(k);
    } catch {
      // Storage blocked: nothing was saved to begin with.
    }
    // The extension's per-chat counts too, if it's installed.
    await forgetExtensionData();
    setCleared(true);
  }

  async function removeEmail(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/waitlist", {
      method: "DELETE",
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

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="border-2 border-rule p-4">
        <p className="font-display text-lg font-bold">Clear this browser</p>
        <p className="mt-1 text-sm text-muted">Removes your plan and answers from this device, and the counts the extension keeps. The page starts fresh.</p>
        <button
          type="button"
          onClick={clearBrowser}
          className="mt-3 min-h-11 rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background"
        >
          {cleared ? "Cleared" : "Clear what's saved here"}
        </button>
      </div>
      <div className="border-2 border-rule p-4">
        <p className="font-display text-lg font-bold">Leave the waitlist</p>
        {state === "done" ? (
          <p className="mt-1 text-sm">Done. That email is no longer on our list.</p>
        ) : (
          <form onSubmit={removeEmail} className="mt-1">
            <p className="text-sm text-muted">Deletes your email from our database for good.</p>
            <label htmlFor="remove-email" className="sr-only">
              Email address
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="remove-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-md border-2 border-border bg-background px-3 focus:border-rule"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="min-h-11 whitespace-nowrap rounded-md border-2 border-rule px-4 font-semibold hover:bg-foreground hover:text-background disabled:opacity-60"
              >
                {state === "sending" ? "Removing…" : "Remove my email"}
              </button>
            </div>
            {state === "error" && <p className="mt-2 text-sm text-red-700">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
